/**
 * Normalization units (HANDOFF §7): the shared normalizer that both the
 * contradiction and unrecorded passes rely on. It must fold:
 *   - number-words ↔ digits   (nineteen ↔ 19, twenty-one ↔ 21)
 *   - casing                   (Green ↔ green)
 *   - leading articles         (the/a/an)
 *   - simple plurals           (eyes ↔ eye, rings ↔ ring)
 *
 * RED on purpose: the Phase-2 `normalize` stub returns its input unchanged, so
 * every equality below fails as an assertion. A later phase makes them pass.
 *
 * These assert on EQUIVALENCE (normalize(a) === normalize(b)) rather than an
 * exact canonical string, so the implementer is free to choose whether the
 * canonical form is the digit or the word — as long as the two collapse
 * together. Where a specific direction matters, that is asserted explicitly.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { normalize } from '@/lib/check';
import { normalizeQuote } from '@/lib/check/normalize';

function eq(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

// The documented mark-key formula: sha1(ruleId | normalizeQuote(quote) | entryId).
// Reproduced here so the test asserts the DOWNSTREAM key, not just the normalizer,
// proving a straight/curly quote pair collapses to the SAME markKey.
function markKeyOf(ruleId: string, quote: string, entryId: string): string {
  return createHash('sha1').update(`${ruleId}|${normalizeQuote(quote)}|${entryId}`).digest('hex');
}

describe('normalize — number-words ↔ digits', () => {
  it('folds nineteen and 19 together', () => {
    expect(eq('nineteen', '19')).toBe(true);
  });

  it('folds twenty-one and 21 together', () => {
    expect(eq('twenty-one', '21')).toBe(true);
  });

  it('does not fold different numbers', () => {
    expect(eq('nineteen', '21')).toBe(false);
  });
});

describe('normalize — casing', () => {
  it('folds Green and green together', () => {
    expect(eq('Green', 'green')).toBe(true);
  });

  it('folds mixed casing of a phrase', () => {
    expect(eq('The Tallow Rule', 'the tallow rule')).toBe(true);
  });
});

describe('normalize — articles', () => {
  it('drops a leading definite article', () => {
    expect(eq('the tallow rule', 'tallow rule')).toBe(true);
  });

  it('drops a leading indefinite article', () => {
    expect(eq('a salt-name', 'salt-name')).toBe(true);
    expect(eq('an oath', 'oath')).toBe(true);
  });
});

describe('normalize — simple plurals', () => {
  it('folds a simple plural to its singular', () => {
    expect(eq('eyes', 'eye')).toBe(true);
    expect(eq('rings', 'ring')).toBe(true);
  });

  it('combined: casing + article + plural on a phrase', () => {
    // "Her own grey eyes" vs the recorded "grey eye" attribute should collapse.
    expect(eq('Grey Eyes', 'grey eye')).toBe(true);
  });
});

describe('normalizeQuote — apostrophe unification (T-WIKI-DEDUP)', () => {
  // A straight (U+0027) and curly (U+2019) apostrophe are the SAME editorial
  // detail. When one chapter writes the quote straight and another curly, the
  // choke-point normalizeQuote must fold both to one canonical form, or the two
  // yield different markKeys and the /wiki poster band shows the SAME card twice.
  const straight = "her mother's brass ring";
  const curly = 'her mother\u2019s brass ring';

  it('collapses a straight and curly apostrophe to the same normalized quote', () => {
    expect(normalizeQuote(straight)).toBe(normalizeQuote(curly));
  });

  it('yields the SAME markKey for the straight/curly twin (dedupe holds)', () => {
    expect(markKeyOf('unrecorded', straight, 'maren')).toBe(
      markKeyOf('unrecorded', curly, 'maren'),
    );
  });

  it('canonicalizes to the straight apostrophe (matches phraseIndexKey direction)', () => {
    expect(normalizeQuote(curly)).toBe(straight);
  });

  it('still folds casing and whitespace alongside the apostrophe', () => {
    expect(normalizeQuote('  Her Mother\u2019s   Brass  Ring  ')).toBe(straight);
  });
});
