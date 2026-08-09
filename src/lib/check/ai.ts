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

import type { Mark, MarkAction } from './index';
import { normalizeQuote } from './normalize';
import { sha1 } from './hash';
import { occurrenceIndexOf } from './text';

/** ruleId namespaces for AI-sourced marks (kept distinct from deterministic rule ids). */
export const AI_CONFLICT_RULE_ID = 'ai-conflict';
export const AI_MISSING_RULE_ID = 'ai-unrecorded';

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
  /** Short reason (rail). */
  reason?: string;
  /** What the wiki actually says (optional, folded into the note). */
  recorded?: string;
}

/** One unrecorded finding as returned by the model. */
export interface AiMissingFinding {
  /** Verbatim manuscript run naming something not in the wiki. */
  quote: string;
  /** Reason / what it is (rail + note). */
  reason?: string;
  /** Proposed fact key if the writer chooses to record it. */
  key?: string;
  /** Proposed fact value if the writer chooses to record it. */
  value?: string;
}

/** The strict JSON shape aiCheckChapter asks the model for. */
export interface AiCheckResponse {
  conflicts?: AiConflictFinding[];
  missing?: AiMissingFinding[];
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
 * @param opts.paragraphIndexByQuote optional hint of where each quote came from,
 *        used only to disambiguate identical substrings across paragraphs.
 */
export function aiResultToMarks(
  response: AiCheckResponse,
  paragraphs: string[],
  opts?: { preferredIndexByQuote?: Record<string, number> },
): Mark[] {
  const marks: Mark[] = [];
  const seen = new Set<string>();
  const preferred = opts?.preferredIndexByQuote ?? {};

  const push = (
    ruleId: string,
    kind: Mark['kind'],
    quoteRaw: string,
    entryId: string,
    rail: string,
    noteText: string,
    actions: MarkAction[],
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

    marks.push({
      markKey: key,
      kind,
      ruleId,
      quote,
      rail,
      noteText,
      actions,
      position: {
        paragraphIndex,
        occurrenceIndex: occurrenceIndexOf(paragraphs[paragraphIndex]!, quote),
      },
    });
  };

  for (const c of response.conflicts ?? []) {
    const reason = (c.reason ?? '').trim() || 'This contradicts your wiki.';
    const recorded = (c.recorded ?? '').trim();
    const note = recorded
      ? `${reason} Your wiki records: ${recorded}.`
      : reason;
    push(
      AI_CONFLICT_RULE_ID,
      'conflict',
      c.quote,
      (c.entryId ?? '').trim(),
      reason,
      note,
      AI_CONFLICT_ACTIONS,
    );
  }

  for (const m of response.missing ?? []) {
    const reason = (m.reason ?? '').trim() || 'This is not written down yet.';
    push(
      AI_MISSING_RULE_ID,
      'missing',
      m.quote,
      '', // unrecorded → no entry to anchor to yet
      reason,
      reason,
      AI_MISSING_ACTIONS,
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
