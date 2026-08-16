/**
 * Behavior-lock (golden-master) for the lexicon `has()` path.
 *
 * lexicon.ts feeds buildLexicon -> findUnrecorded, so any change to lexicon
 * that altered which phrases count as "already recorded" would change the set
 * of `missing` marks (m2/m3) and their projected suggestions (s1/s2).
 *
 * This test captures the FULL deterministic `checkManuscript` output on the
 * seeded fixtures, serialized canonically, and asserts it byte-for-byte against
 * a baseline captured at HEAD. It is a refactor guard: the SAME assertion must
 * stay byte-green before and after the normalizePhrase inlining. Editing the
 * expected string mid-refactor voids the proof.
 *
 * Determinism: marks and suggestions are sorted by a stable key before
 * serialization so array order (not under test here) cannot cause churn.
 */

import { describe, it, expect } from 'vitest';
import { checkManuscript } from '@/lib/check';
import type { Mark, Suggestion } from '@/lib/check';
import { wiki, chapter7Paragraphs, consistentParagraphs } from './fixtures';

function canonicalMark(m: Mark): string {
  return [
    m.kind,
    m.ruleId,
    m.quote,
    m.markKey,
    m.entityId ?? '',
    m.position.paragraphIndex,
    m.position.occurrenceIndex,
    m.actions.map((a) => a.id).join('+'),
  ].join(' | ');
}

function canonicalSuggestion(s: Suggestion): string {
  return [s.source, s.key, s.value].join(' | ');
}

function golden(paragraphs: string[]): string {
  const { marks, suggestions } = checkManuscript({ paragraphs, wiki });
  const markLines = marks.map(canonicalMark).sort();
  const sugLines = suggestions.map(canonicalSuggestion).sort();
  return ['MARKS:', ...markLines, 'SUGGESTIONS:', ...sugLines].join('\n');
}

describe('lexicon golden-master — checkManuscript on seeded fixtures', () => {
  it('Chapter 7: exact serialized marks + suggestions are unchanged', () => {
    expect(golden(chapter7Paragraphs)).toBe(GOLDEN_CHAPTER7);
  });

  it('consistent manuscript: zero marks + zero suggestions', () => {
    expect(golden(consistentParagraphs)).toBe(GOLDEN_CONSISTENT);
  });
});

// Baselines captured at HEAD before the normalizePhrase inlining. DO NOT edit
// these to make a refactor pass — a diff here means behavior changed.
//
// T-WIKI-DEDUP re-baseline (reviewed, not a silent bless): normalizeQuote now
// folds the curly apostrophe (U+2019 -> U+0027) so a phrase written straight in
// one chapter and curly in another yields ONE markKey (the /wiki poster band was
// showing the "her mother's brass ring" card twice). That intentionally changes
// exactly ONE line below — the brass-ring missing markKey
// 06e402d4... -> 9457d9f8... The tallow-rule key (no apostrophe), both conflict
// keys (no apostrophe), and every SUGGESTIONS line are BYTE-UNCHANGED, proving
// the fold touched only apostrophe-bearing quotes and nothing else.
const GOLDEN_CHAPTER7 = [
  'MARKS:',
  'conflict | attribute-mismatch | Her own grey eyes | 934b5b4eeb9418df6734007878068a7b9bcf41c0 | maren | 2 | 0 | wiki+text+leave',
  'conflict | constraint-violation | nineteen and sworn | 921875d39deeefc48ed3ccbdbc9c155a3c9b16bb | maren | 0 | 0 | wiki+text+leave',
  'missing | unrecorded | her mother’s brass ring | 9457d9f862f84a41d9c73c0b44f694d0dd276f10 | maren | 1 | 0 | add+edit+leave',
  'missing | unrecorded | the tallow rule | 4602863bd83a90d7c07112ed2648ab00bbf59759 | vergelight | 1 | 0 | add+edit+leave',
  'SUGGESTIONS:',
  'Chapter 7 | Carries | Her mother’s brass ring',
  'Chapter 7 | Rule | The tallow rule — no oil in the Verge Light',
].join('\n');

const GOLDEN_CONSISTENT = ['MARKS:', 'SUGGESTIONS:'].join('\n');
