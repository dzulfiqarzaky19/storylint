/**
 * Unrecorded U1 (possessed-heirloom) object filtering.
 *
 * Two live defects motivated these tests, both on Chapter 1's opening line
 * ("Maren stood at the graveside in her mother's coat and did not cry"):
 *
 *   1. The U1 regex's trailing two-word group swallowed the conjunction, so the
 *      flagged span was "her mother's coat and" (a dangling "and").
 *   2. More fundamentally, a bare common noun ("coat") is an incidental prop,
 *      not a gazetteer-worthy artifact, yet it was flagged the same as a real
 *      heirloom. Importance here = the object is QUALIFIED (modifier + noun),
 *      e.g. "her mother's brass ring".
 *
 * These lock: a qualified object flags, a bare-noun object does not, and the
 * emitted quote never includes a trailing conjunction / the next clause. The
 * seeded Chapter-7 heirloom ("her mother's brass ring") staying flagged is
 * covered by engine.test.ts; here we exercise the object filter in isolation.
 */

import { describe, it, expect } from 'vitest';
import { findUnrecorded } from '@/lib/check/unrecorded';
import { wiki } from './fixtures';

function quotes(paragraphs: string[]): string[] {
  return findUnrecorded(paragraphs, wiki).map((m) => m.quote);
}

describe('findUnrecorded U1 object filter', () => {
  it('flags a qualified possessed object (modifier + noun)', () => {
    // "brass ring" is a qualified artifact -> gazetteer-worthy.
    const q = quotes(['Maren turned her mother\u2019s brass ring twice in her pocket.']);
    expect(q).toContain('her mother\u2019s brass ring');
  });

  it('does NOT flag a bare common-noun object', () => {
    // "coat" is a bare prop, not a named artifact -> skipped entirely.
    const q = quotes(['Maren stood at the graveside in her mother\u2019s coat and did not cry.']);
    expect(q).not.toContain('her mother\u2019s coat and');
    expect(q).not.toContain('her mother\u2019s coat');
    expect(q.some((s) => s.includes('coat'))).toBe(false);
  });

  it('never emits a quote that includes a trailing conjunction', () => {
    // Even a qualified object followed by "and" must stop before the conjunction.
    const q = quotes(['She kept her mother\u2019s brass ring and walked to the water.']);
    expect(q).toContain('her mother\u2019s brass ring');
    expect(q.every((s) => !/\band\b\s*$/.test(s))).toBe(true);
    expect(q).not.toContain('her mother\u2019s brass ring and');
  });

  it('does not run the object past the clause boundary into a verb', () => {
    // "coat did" would be nonsense; the object stops at "did".
    const q = quotes(['He wore his father\u2019s coat did not fit him at all.']);
    expect(q.every((s) => !s.includes('did'))).toBe(true);
  });
});
