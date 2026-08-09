/**
 * Within-chapter recurrence as an importance ranking (Tier 1).
 *
 * A phrase the author leans on (appears >= 2x in the chapter) is ranked
 * 'high'; a single mention is 'normal'. Recurrence RANKS, it never gates: a
 * once-mentioned heirloom still surfaces (the engine contract in
 * engine.test.ts requires the single-occurrence Chapter-7 phrases to flag).
 *
 * These lock: the count is correct, importance follows the count, a single
 * mention still produces a mark, and importanceRank orders 'high' first.
 */

import { describe, it, expect } from 'vitest';
import { findUnrecorded } from '@/lib/check/unrecorded';
import { importanceRank } from '@/lib/check';
import type { Mark } from '@/lib/check';
import { wiki } from './fixtures';

function markFor(paragraphs: string[], quote: string): Mark | undefined {
  return findUnrecorded(paragraphs, wiki).find((m) => m.quote === quote);
}

describe('within-chapter recurrence', () => {
  it('counts a phrase mentioned twice and ranks it high', () => {
    const q = 'her mother\u2019s brass ring';
    const m = markFor(
      [
        `Maren turned ${q} in her pocket.`,
        `She kept ${q} and turned it twice.`,
      ],
      q,
    );
    expect(m).toBeDefined();
    expect(m!.recurrence).toBe(2);
    expect(m!.importance).toBe('high');
    // Recurring copy asserts the count on the rail.
    expect(m!.rail).toContain('appears 2 times');
  });

  it('ranks a single mention normal but STILL flags it (rank, not gate)', () => {
    const q = 'her mother\u2019s brass ring';
    const m = markFor([`Maren turned ${q} in her pocket.`], q);
    expect(m).toBeDefined(); // single mention still surfaces
    expect(m!.recurrence).toBe(1);
    expect(m!.importance).toBe('normal');
    expect(m!.rail).not.toContain('appears'); // gentle single-mention copy
  });

  it('importanceRank orders high before normal before low', () => {
    expect(importanceRank('high')).toBeLessThan(importanceRank('normal'));
    expect(importanceRank('normal')).toBeLessThan(importanceRank('low'));
    // undefined sorts as normal (older marks / contradictions stay mid-rank).
    expect(importanceRank(undefined)).toBe(importanceRank('normal'));
  });
});

describe('cross-chapter recurrence (Tier 2)', () => {
  const q = 'her mother\u2019s brass ring';
  const singleMention = [`Maren turned ${q} in her pocket.`];

  it('upgrades a single-mention phrase to high when it recurs across chapters', () => {
    // Same phrase, once in THIS chapter, but the book-wide index says it appears
    // in 3 chapters. Cross-chapter recurrence ranks it 'high'.
    const counts = new Map<string, number>([[q.toLowerCase(), 3]]);
    const m = findUnrecorded(singleMention, wiki, undefined, counts).find(
      (x) => x.quote === q,
    );
    expect(m).toBeDefined();
    expect(m!.recurrence).toBe(1); // within-chapter count unchanged
    expect(m!.importance).toBe('high'); // ranked up by the cross-chapter signal
  });

  it('still flags the phrase, and stays normal, when it appears in only one chapter', () => {
    const counts = new Map<string, number>([[q.toLowerCase(), 1]]);
    const m = findUnrecorded(singleMention, wiki, undefined, counts).find(
      (x) => x.quote === q,
    );
    expect(m).toBeDefined(); // rank, never gate
    expect(m!.importance).toBe('normal');
  });

  it('degrades to Tier 1 when no index is supplied (undefined map)', () => {
    const m = findUnrecorded(singleMention, wiki).find((x) => x.quote === q);
    expect(m).toBeDefined();
    expect(m!.importance).toBe('normal');
  });
});
