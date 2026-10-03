import { describe, expect, it } from 'vitest';

import {
  checkManuscript,
  importanceRank,
  railLabel,
  type MarkImportance,
  type MarkKind,
} from './index';
import { entry, wiki } from './testing/wiki';

const WIKI = wiki(
  entry('maren', 'Maren Vale', { facts: { Eyes: 'Grey' } }),
  entry('light', 'Verge Light', { kind: 'world', note: 'Burns tallow only' }),
);

const PARAGRAPHS = ['Her green eyes narrowed.', 'They broke the tallow rule.'];

function keyOf(kind: MarkKind): string {
  const found = checkManuscript({ paragraphs: PARAGRAPHS, wiki: WIKI }).marks.find(
    (m) => m.kind === kind,
  );
  if (!found) throw new Error(`fixture produced no ${kind} mark`);
  return found.markKey;
}

describe('checkManuscript', () => {
  it('returns no marks and no suggestions for prose that agrees with the wiki', () => {
    const result = checkManuscript({ paragraphs: ['Her grey eyes narrowed.'], wiki: WIKI });

    expect(result).toEqual({ marks: [], suggestions: [] });
  });

  it('returns contradictions first, then unrecorded phrases', () => {
    const { marks } = checkManuscript({ paragraphs: PARAGRAPHS, wiki: WIKI });

    expect(marks.map((m) => [m.kind, m.quote])).toEqual([
      ['conflict', 'Her green eyes'],
      ['missing', 'the tallow rule'],
    ]);
  });

  it('leaves out a mark the writer has already resolved', () => {
    const { marks } = checkManuscript({
      paragraphs: PARAGRAPHS,
      wiki: WIKI,
      resolvedMarkKeys: [keyOf('conflict')],
    });

    expect(marks.map((m) => m.kind)).toEqual(['missing']);
  });

  it('suggests a wiki fact for each unrecorded phrase, never for a contradiction', () => {
    const { suggestions } = checkManuscript({ paragraphs: PARAGRAPHS, wiki: WIKI });

    expect(suggestions.map((s) => s.key)).toEqual(['Rule']);
  });

  it('drops a dismissed suggestion but keeps its mark', () => {
    const result = checkManuscript({
      paragraphs: PARAGRAPHS,
      wiki: WIKI,
      dismissedSuggestionKeys: ['Rule'],
    });

    expect(result.suggestions).toEqual([]);
    expect(result.marks.map((m) => m.quote)).toContain('the tallow rule');
  });

  it('drops the suggestion along with a resolved unrecorded mark', () => {
    const result = checkManuscript({
      paragraphs: PARAGRAPHS,
      wiki: WIKI,
      resolvedMarkKeys: [keyOf('missing')],
    });

    expect(result.suggestions).toEqual([]);
  });

  it('raises an unrecorded phrase to high importance from book-wide chapter counts', () => {
    const { marks } = checkManuscript({
      paragraphs: PARAGRAPHS,
      wiki: WIKI,
      chapterCounts: new Map([['the tallow rule', 3]]),
    });

    expect(marks.find((m) => m.kind === 'missing')?.importance).toBe('high');
  });
});

describe('railLabel', () => {
  it.each([
    ['conflict', 'Contradiction'],
    ['missing', 'Unrecorded'],
  ] as const)('labels %s as %s', (kind, label) => {
    expect(railLabel(kind)).toBe(label);
  });
});

describe('importanceRank', () => {
  it('orders high before normal before low', () => {
    const shuffled: MarkImportance[] = ['low', 'high', 'normal'];

    expect(shuffled.sort((a, b) => importanceRank(a) - importanceRank(b))).toEqual([
      'high',
      'normal',
      'low',
    ]);
  });

  it('ranks a mark with no importance the same as normal', () => {
    expect(importanceRank(undefined)).toBe(importanceRank('normal'));
  });
});
