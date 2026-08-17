/**
 * AI check — pure mapping layer (no network here).
 *
 * The AI *reasoning* lives in a server action (src/lib/actions/write.ts →
 * aiCheckChapter) which talks to the SaaRouters gateway. THIS module is the pure,
 * dependency-light half: it turns the model's JSON into the exact same `Mark[]`
 * the deterministic engine emits, so the write UI renders AI findings with the
 * identical underline / rail / note / action affordances. Being pure keeps it
 * unit-testable with zero network.
 *
 * PRODUCT RULE 1 is preserved structurally: AI marks carry the same actions as
 * deterministic marks, so an "add to wiki" click routes through resolveMark's
 * confirmation path. Nothing here writes to the wiki.
 *
 * GROUNDING GUARD: the model is asked to quote verbatim, but it can drift or
 * hallucinate. We only keep a finding whose `quote` is an exact substring of the
 * paragraph it claims to be in. Anything we cannot locate in the manuscript is
 * dropped — a mark we cannot anchor is worse than no mark.
 */

import type { Mark, MarkAction, ResolvedTarget, CheckedAgainst } from './index';
import { normalizeQuote } from './normalize';
import { sha1 } from './hash';
import { occurrenceIndexOf } from './text';

/** ruleId namespaces for AI-sourced marks (kept distinct from deterministic rule ids). */
export const AI_CONFLICT_RULE_ID = 'ai-conflict';
export const AI_MISSING_RULE_ID = 'ai-unrecorded';
/**
 * newEntity findings (TCK-016) ride the SAME writer-confirm path as `missing`
 * but carry a DISTINCT ruleId so they de-dupe separately in the markKey and can
 * be told apart from a plain "unrecorded fact" finding.
 */
export const AI_NEW_ENTITY_RULE_ID = 'ai-new-entity';

/**
 * The wiki kinds a proposed new entity may claim — shared with TCK-015's research
 * classification allowlist. An out-of-list kind from the model is clamped to the
 * safe default rather than surfaced verbatim.
 */
const NEW_ENTITY_KINDS = ['character', 'world', 'organization', 'lore'] as const;
type NewEntityKind = (typeof NEW_ENTITY_KINDS)[number];
const NEW_ENTITY_KIND_FALLBACK: NewEntityKind = 'lore';

function clampEntityKind(kind: string | undefined): NewEntityKind {
  const k = (kind ?? '').trim().toLowerCase();
  return (NEW_ENTITY_KINDS as readonly string[]).includes(k)
    ? (k as NewEntityKind)
    : NEW_ENTITY_KIND_FALLBACK;
}

// Same affordances as the deterministic engine so the UI + resolveMark path are
// identical for AI and non-AI marks.
const AI_CONFLICT_ACTIONS: MarkAction[] = [
  { id: 'wiki', label: 'The wiki is out of date — change it' },
  { id: 'text', label: 'Change the sentence' },
  { id: 'leave', label: 'It’s deliberate, leave it' },
];

const AI_MISSING_ACTIONS: MarkAction[] = [
  { id: 'add', label: 'Add to the wiki' },
  { id: 'edit', label: 'Add, but let me word it' },
  { id: 'leave', label: 'Not now' },
];

/** One conflict finding as returned by the model. */
export interface AiConflictFinding {
  /** Verbatim manuscript run that contradicts the wiki. */
  quote: string;
  /** Wiki entry id this contradicts (best-effort; may be empty). */
  entryId?: string;
  /**
   * The gazetteer fact KEY the claim was checked against (e.g. "chair-count").
   * Human-readable and already visible to the model, so it echoes a key rather
   * than an opaque fact id; the server resolves (entryId, factKey) -> factId.
   */
  factKey?: string;
  /** Short reason (rail). */
  reason?: string;
  /** What the wiki actually says (optional, folded into the note). */
  recorded?: string;
  /** Model paragraph index hint (disambiguates identical substrings only). */
  paragraph?: number;
}

/** One unrecorded finding as returned by the model. */
export interface AiMissingFinding {
  /** Verbatim manuscript run naming something not in the wiki. */
  quote: string;
  /**
   * Wiki entry id the new fact belongs to, when the subject is a KNOWN entity
   * (same bracketed-id mechanism conflicts use). Empty when the subject itself
   * is not yet in the wiki.
   */
  entryId?: string;
  /** Reason / what it is (rail + note). */
  reason?: string;
  /** Proposed fact key if the writer chooses to record it. */
  key?: string;
  /** Proposed fact value if the writer chooses to record it. */
  value?: string;
  /** Model paragraph index hint (disambiguates identical substrings only). */
  paragraph?: number;
}

/** One new-entity finding as returned by the model (TCK-016). */
export interface AiNewEntityFinding {
  /** Verbatim manuscript run that introduces a subject not in the wiki. */
  quote: string;
  /** Proposed display name for the new entry (e.g. "Saint Osk"). */
  name?: string;
  /** Proposed wiki kind (character | world | organization | lore); clamped if out-of-list. */
  kind?: string;
  /** Short reason / what it is (rail + note). */
  reason?: string;
  /** Model paragraph index hint (disambiguates identical substrings only). */
  paragraph?: number;
}

/** The strict JSON shape aiCheckChapter asks the model for. */
export interface AiCheckResponse {
  conflicts?: AiConflictFinding[];
  missing?: AiMissingFinding[];
  newEntity?: AiNewEntityFinding[];
}

function markKey(ruleId: string, quote: string, entryId: string): string {
  return sha1(`${ruleId}|${normalizeQuote(quote)}|${entryId}`);
}

/**
 * Locate the paragraph index a quote actually lives in. Returns -1 when the
 * quote is not a verbatim substring of ANY paragraph (the grounding guard).
 *
 * When `preferredIndex` is provided and the quote is present there, that index
 * wins (the model told us where it looked); otherwise we take the first match.
 */
function locateParagraph(
  paragraphs: string[],
  quote: string,
  preferredIndex?: number,
): number {
  if (
    preferredIndex !== undefined &&
    preferredIndex >= 0 &&
    preferredIndex < paragraphs.length &&
    paragraphs[preferredIndex]!.includes(quote)
  ) {
    return preferredIndex;
  }
  return paragraphs.findIndex((p) => p.includes(quote));
}

/**
 * Map a validated AI response to `Mark[]`.
 *
 * @param response   parsed model JSON
 * @param paragraphs the CURRENT manuscript paragraphs (for grounding + position)
 * @param opts.preferredIndexByQuote optional hint of where each quote came from,
 *        used only to disambiguate identical substrings across paragraphs.
 * @param opts.factIdByEntryKey optional `${entryId}\u0000${factKey}` -> factId
 *        map from the loaded wiki snapshot. Lets the pure mapper attach the
 *        stable server-side factId to `checkedAgainst` WITHOUT the model ever
 *        echoing an opaque id; absent/unmatched leaves factId unset (never
 *        fabricated).
 */
export function aiResultToMarks(
  response: AiCheckResponse,
  paragraphs: string[],
  opts?: {
    preferredIndexByQuote?: Record<string, number>;
    factIdByEntryKey?: Record<string, string>;
  },
): Mark[] {
  const marks: Mark[] = [];
  const seen = new Set<string>();
  const preferred = opts?.preferredIndexByQuote ?? {};
  const factIdByEntryKey = opts?.factIdByEntryKey ?? {};

  // The AI signal’s existing wiki source, with factId resolved server-side
  // from (entryId, factKey). Returns undefined when nothing was checked against,
  // so a pure not-written-down mark carries no checkedAgainst at all.
  const buildCheckedAgainst = (
    entryId: string,
    factKey: string,
    recordedValue: string,
  ): CheckedAgainst | undefined => {
    const eid = entryId.trim();
    const key = factKey.trim();
    const recorded = recordedValue.trim();
    if (!eid && !key && !recorded) return undefined;
    const factId = eid && key ? factIdByEntryKey[`${eid}\u0000${key}`] : undefined;
    const ca: CheckedAgainst = {};
    if (eid) ca.entryId = eid;
    if (key) ca.factKey = key;
    if (factId) ca.factId = factId;
    if (recorded) ca.recordedValue = recorded;
    return ca;
  };

  const push = (
    ruleId: string,
    kind: Mark['kind'],
    quoteRaw: string,
    entryId: string,
    rail: string,
    noteText: string,
    actions: MarkAction[],
    targets?: {
      resolvedTarget?: ResolvedTarget;
      checkedAgainst?: CheckedAgainst;
    },
  ) => {
    const quote = (quoteRaw ?? '').trim();
    if (!quote) return;

    // The model sometimes echoes the bracketed gazetteer id ("[sept]"); strip the
    // wrapping brackets so `entryId` matches the real wiki entry id ("sept") and
    // the markKey is stable regardless of that formatting choice.
    const entry = entryId.replace(/^\[+|\]+$/g, '').trim();

    const paragraphIndex = locateParagraph(paragraphs, quote, preferred[quote]);
    if (paragraphIndex === -1) return; // grounding guard: cannot anchor → drop.

    const key = markKey(ruleId, quote, entry);
    if (seen.has(key)) return;
    seen.add(key);

    const mark: Mark = {
      markKey: key,
      kind,
      ruleId,
      quote,
      rail,
      noteText,
      actions,
      // The stripped, real wiki entry id the model anchored this conflict to
      // (empty for `missing`, where nothing is recorded yet). undefined rather
      // than '' so explainMark's focusEntityIds seam stays clean.
      entityId: entry || undefined,
      position: {
        paragraphIndex,
        occurrenceIndex: occurrenceIndexOf(paragraphs[paragraphIndex]!, quote),
      },
    };
    if (targets?.resolvedTarget) mark.resolvedTarget = targets.resolvedTarget;
    if (targets?.checkedAgainst) mark.checkedAgainst = targets.checkedAgainst;
    marks.push(mark);
  };

  for (const c of response.conflicts ?? []) {
    const reason = (c.reason ?? '').trim() || 'This contradicts your wiki.';
    const recorded = (c.recorded ?? '').trim();
    const note = recorded
      ? `${reason} Your wiki records: ${recorded}.`
      : reason;
    const entryId = (c.entryId ?? '').trim().replace(/^\[+|\]+$/g, '').trim();
    const factKey = (c.factKey ?? '').trim();
    // A contradiction was READ FROM the entry/fact it disagrees with, so
    // checkedAgainst and the write-target share that entry. resolvedTarget
    // leaves category unresolved here (the pure mapper lacks the entity’s
    // kind); the modal/caller fills it from the snapshot.
    const checkedAgainst = buildCheckedAgainst(entryId, factKey, recorded);
    const resolvedTarget: ResolvedTarget | undefined = entryId
      ? { category: {}, entry: { id: entryId } }
      : undefined;
    push(
      AI_CONFLICT_RULE_ID,
      'conflict',
      c.quote,
      entryId,
      reason,
      note,
      AI_CONFLICT_ACTIONS,
      { resolvedTarget, checkedAgainst },
    );
  }

  for (const m of response.missing ?? []) {
    const reason = (m.reason ?? '').trim() || 'This is not written down yet.';
    // A new fact about a KNOWN entity resolves its write-target to that entry;
    // an unknown subject leaves the target unresolved for the writer to pick.
    const entryId = (m.entryId ?? '').trim().replace(/^\[+|\]+$/g, '').trim();
    const key = (m.key ?? '').trim();
    const value = (m.value ?? '').trim();
    const resolvedTarget: ResolvedTarget | undefined = entryId
      ? {
          category: {},
          entry: { id: entryId },
          ...(key && value ? { fact: { key, value } } : {}),
        }
      : undefined;
    // Missing = nothing recorded yet, so there is usually no wiki source it was
    // checked against. If the model DID cite the entry it looked at, keep that
    // as the source (factKey empty since the fact is precisely what is absent).
    const checkedAgainst = buildCheckedAgainst(entryId, '', '');
    push(
      AI_MISSING_RULE_ID,
      'missing',
      m.quote,
      '', // markKey anchor stays empty: the FACT is unrecorded even when its entity is known
      reason,
      reason,
      AI_MISSING_ACTIONS,
      { resolvedTarget, checkedAgainst },
    );
  }

  for (const n of response.newEntity ?? []) {
    const kind = clampEntityKind(n.kind);
    const name = (n.name ?? '').trim();
    const why = (n.reason ?? '').trim();
    // Rail names the proposed entry + its kind so the writer sees WHAT is being
    // proposed before confirming (RULE 1). Note adds the model's reason.
    const subject = name ? `${name} (${kind})` : `a new ${kind}`;
    const rail = `New ${kind} to record: ${name || 'this subject'}`;
    const note = why
      ? `Proposes a new wiki entry — ${subject}. ${why}`
      : `Proposes a new wiki entry — ${subject}.`;
    // A brand-new subject proposes a NEW entry by name at both the category
    // (its kind) and entry levels — proposeName, never an id, since neither
    // exists yet. No checkedAgainst: there is no wiki source, that is the point.
    const resolvedTarget: ResolvedTarget = {
      category: { proposeName: kind },
      entry: { proposeName: name || undefined, proposeKind: kind },
    };
    push(
      AI_NEW_ENTITY_RULE_ID,
      'missing', // rides the writer-confirm path; NOT a conflict (RULE 2)
      n.quote,
      '', // nothing recorded yet → no entry to anchor to
      rail,
      note,
      AI_MISSING_ACTIONS,
      { resolvedTarget },
    );
  }

  return marks;
}

/**
 * Merge AI marks with deterministic marks, de-duplicated by markKey. Deterministic
 * marks win on collision (they are cheaper/certain), but since AI marks use
 * distinct ruleIds a true key collision is rare.
 */
export function mergeMarks(deterministic: Mark[], ai: Mark[]): Mark[] {
  const byKey = new Map<string, Mark>();
  for (const m of deterministic) byKey.set(m.markKey, m);
  for (const m of ai) if (!byKey.has(m.markKey)) byKey.set(m.markKey, m);
  return [...byKey.values()];
}

// ---------------------------------------------------------------------------
// Changed-paragraph diffing — so save-time AI checks only re-examine the prose
// the writer actually touched, not the whole chapter every time.
// ---------------------------------------------------------------------------

/** A stable content hash for one paragraph (whitespace-normalized). */
export function paragraphHash(paragraph: string): string {
  return sha1(paragraph.replace(/\s+/g, ' ').trim());
}

/** Hash every paragraph, index-aligned with the input. */
export function hashParagraphs(paragraphs: string[]): string[] {
  return paragraphs.map(paragraphHash);
}

/**
 * Which paragraph indices are new or changed vs the previous hash list.
 * A first pass (empty `previousHashes`) returns every index.
 */
export function changedParagraphIndices(
  paragraphs: string[],
  previousHashes: string[],
): number[] {
  const changed: number[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    if (previousHashes[i] !== paragraphHash(paragraphs[i]!)) changed.push(i);
  }
  return changed;
}

/**
 * Reconcile a fresh set of AI marks (from re-checking only the changed
 * paragraphs) with the previously-cached AI marks, so untouched paragraphs keep
 * their marks and deleted/edited paragraphs lose stale ones.
 *
 * @param previousAiMarks  all AI marks from the last full/partial pass
 * @param freshAiMarks     AI marks produced for `changedIndices` this pass
 * @param changedIndices   paragraph indices that were re-checked
 * @param paragraphCount   current paragraph count (drops marks pointing past it)
 */
export function reconcileAiMarks(
  previousAiMarks: Mark[],
  freshAiMarks: Mark[],
  changedIndices: number[],
  paragraphCount: number,
): Mark[] {
  const changed = new Set(changedIndices);
  // Keep prior marks only for paragraphs we did NOT re-check and that still exist.
  const kept = previousAiMarks.filter(
    (m) =>
      !changed.has(m.position.paragraphIndex) &&
      m.position.paragraphIndex < paragraphCount,
  );
  return mergeMarks(kept, freshAiMarks);
}
