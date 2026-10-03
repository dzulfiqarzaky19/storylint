export type EntryKind = 'character' | 'world' | 'organization' | 'lore';

export interface WikiFact {
  id: string;
  entryId: string;
  key: string;
  value: string;
}

export interface WikiEntry {
  id: string;
  kind: EntryKind;
  name: string;
  aliases?: string[];
  note?: string;
  facts: WikiFact[];
}

export interface CheckWiki {
  entries: WikiEntry[];
}

export type MarkKind = 'conflict' | 'missing';

export type MarkRailLabel = 'Contradiction' | 'Unrecorded';

export function railLabel(kind: MarkKind): MarkRailLabel {
  return kind === 'conflict' ? 'Contradiction' : 'Unrecorded';
}

export interface MarkAction {
  id: string;
  label: string;
}

export interface MarkPosition {
  paragraphIndex: number;
  occurrenceIndex: number;
}

export interface Mark {
  markKey: string;
  kind: MarkKind;
  ruleId: string;
  quote: string;
  rail: string;
  noteText: string;
  actions: MarkAction[];
  position: MarkPosition;
  entityId?: string;
  importance?: MarkImportance;
  recurrence?: number;
  resolvedTarget?: ResolvedTarget;
  checkedAgainst?: CheckedAgainst;
}

export interface ResolvedTarget {
  category: { id?: string; proposeName?: string };
  entry: { id?: string; proposeName?: string; proposeKind?: string };
  fact?: { key: string; value: string };
}

export interface CheckedAgainst {
  entryId?: string;
  factKey?: string;
  factId?: string;
  recordedValue?: string;
}

export type MarkImportance = 'high' | 'normal' | 'low';

export function importanceRank(importance?: MarkImportance): number {
  switch (importance) {
    case 'high':
      return 0;
    case 'low':
      return 2;
    default:
      return 1;
  }
}

export interface Suggestion {
  source: string;
  text: string;
  key: string;
  value: string;
}

export interface CheckInput {
  paragraphs: string[];
  wiki: CheckWiki;
  focusEntryId?: string;
  resolvedMarkKeys?: string[];
  dismissedSuggestionKeys?: string[];
  chapterCounts?: ReadonlyMap<string, number>;
}

export interface CheckResult {
  marks: Mark[];
  suggestions: Suggestion[];
}

import { findContradictions } from './contradiction';
import { findUnrecorded } from './unrecorded';
import { buildLexicon } from './lexicon';
import { projectSuggestion } from './suggestions';

export { normalize } from './normalize';

export function checkManuscript(input: CheckInput): CheckResult {
  const { paragraphs, wiki, resolvedMarkKeys, dismissedSuggestionKeys, chapterCounts } = input;

  const resolved = new Set(resolvedMarkKeys ?? []);
  const dismissed = new Set(dismissedSuggestionKeys ?? []);

  const lexicon = buildLexicon(wiki);

  const contradictions = findContradictions(paragraphs, wiki);
  const unrecorded = findUnrecorded(paragraphs, wiki, lexicon, chapterCounts);

  const marks: Mark[] = [...contradictions, ...unrecorded].filter(
    (m) => !resolved.has(m.markKey),
  );

  const suggestions: Suggestion[] = marks
    .filter((m) => m.kind === 'missing')
    .map((m) => projectSuggestion(m))
    .filter((s): s is Suggestion => s !== null)
    .filter((s) => !dismissed.has(s.key));

  return { marks, suggestions };
}
