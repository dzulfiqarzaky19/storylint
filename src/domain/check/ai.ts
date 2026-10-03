import type { Mark, MarkAction, ResolvedTarget, CheckedAgainst } from './index';
import { normalizeQuote } from './normalize';
import { sha1 } from './hash';

export const AI_CONFLICT_RULE_ID = 'ai-conflict';
export const AI_MISSING_RULE_ID = 'ai-unrecorded';
export const AI_NEW_ENTITY_RULE_ID = 'ai-new-entity';

const NEW_ENTITY_KINDS = ['character', 'world', 'organization', 'lore'] as const;
type NewEntityKind = (typeof NEW_ENTITY_KINDS)[number];
const NEW_ENTITY_KIND_FALLBACK: NewEntityKind = 'lore';

function clampEntityKind(kind: string | undefined): NewEntityKind {
  const k = (kind ?? '').trim().toLowerCase();
  return (NEW_ENTITY_KINDS as readonly string[]).includes(k)
    ? (k as NewEntityKind)
    : NEW_ENTITY_KIND_FALLBACK;
}

const AI_CONFLICT_ACTIONS: MarkAction[] = [
  { id: 'wiki', label: 'The wiki is out of date — change it' },
  { id: 'text', label: 'Ask AI' },
];

const AI_MISSING_ACTIONS: MarkAction[] = [
  { id: 'add', label: 'Add to the wiki' },
  { id: 'edit', label: 'Ask AI' },
  { id: 'leave', label: 'Remove suggestion' },
];

export interface AiConflictFinding {
  quote: string;
  entryId?: string;
  factKey?: string;
  reason?: string;
  recorded?: string;
  suggested?: string;
  paragraph?: number;
}

export interface AiMissingFinding {
  quote: string;
  entryId?: string;
  reason?: string;
  key?: string;
  value?: string;
  paragraph?: number;
}

export interface AiNewEntityFinding {
  quote: string;
  name?: string;
  kind?: string;
  reason?: string;
  paragraph?: number;
}

export interface AiCheckResponse {
  conflicts?: AiConflictFinding[];
  missing?: AiMissingFinding[];
  newEntity?: AiNewEntityFinding[];
}

function markKey(ruleId: string, quote: string, entryId: string): string {
  return sha1(`${ruleId}|${normalizeQuote(quote)}|${entryId}`);
}

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
    // brackets so the markKey does not depend on that formatting.
    const entry = entryId.replace(/^\[+|\]+$/g, '').trim();

    // Grounding guard: a finding whose quote is not a verbatim substring of the
    // manuscript is dropped, because a mark that cannot be anchored is worse than none.
    const paragraphIndex = locateParagraph(paragraphs, quote, preferred[quote]);
    if (paragraphIndex === -1) return;

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
      entityId: entry || undefined,
      position: {
        paragraphIndex,
        // The model returns the quote alone, with no offset, so the mark anchors
        // to the first occurrence in its paragraph.
        occurrenceIndex: 0,
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
    const suggested = (c.suggested ?? '').trim();
    const checkedAgainst = buildCheckedAgainst(entryId, factKey, recorded);
    const resolvedTarget: ResolvedTarget | undefined = entryId
      ? {
          category: {},
          entry: { id: entryId },
          ...(factKey ? { fact: { key: factKey, value: suggested } } : {}),
        }
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
    const checkedAgainst = buildCheckedAgainst(entryId, '', '');
    push(
      AI_MISSING_RULE_ID,
      'missing',
      m.quote,
      '',
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
    const subject = name ? `${name} (${kind})` : `a new ${kind}`;
    const rail = `New ${kind} to record: ${name || 'this subject'}`;
    const note = why
      ? `Proposes a new wiki entry — ${subject}. ${why}`
      : `Proposes a new wiki entry — ${subject}.`;
    const resolvedTarget: ResolvedTarget = {
      category: { proposeName: kind },
      entry: { proposeName: name || undefined, proposeKind: kind },
    };
    push(
      AI_NEW_ENTITY_RULE_ID,
      'missing',
      n.quote,
      '',
      rail,
      note,
      AI_MISSING_ACTIONS,
      { resolvedTarget },
    );
  }

  return marks;
}

// Deterministic marks win on a markKey collision: they are certain, the AI's are not.
export function mergeMarks(deterministic: Mark[], ai: Mark[]): Mark[] {
  const byKey = new Map<string, Mark>();
  for (const m of deterministic) byKey.set(m.markKey, m);
  for (const m of ai) if (!byKey.has(m.markKey)) byKey.set(m.markKey, m);
  return [...byKey.values()];
}
