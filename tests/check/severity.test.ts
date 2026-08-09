/**
 * chapterSeverity — the pure derive that turns a chapter's marks into a single
 * left-index dot severity (Feature 1). Behavior contract:
 *   - 'red'    iff ANY mark.kind === 'conflict'   (a contradiction dominates)
 *   - 'yellow' iff no conflict but SOME mark.kind === 'missing' (unrecorded only)
 *   - null     iff no marks at all (clean chapter -> no dot)
 *
 * `kind` is 'conflict' | 'missing' (src/lib/check index.ts:63) — NOT
 * 'contradiction'. The dot inherits the rail's own conflict/missing vocabulary.
 *
 * These are RED before severity.ts exists (import resolves to nothing); they
 * fail as assertions once the stub is in place. Pure, no DB, no React.
 */

import { describe, it, expect } from 'vitest';
import { chapterSeverity } from '@/lib/check/severity';
import type { Mark } from '@/lib/check';

/** Minimal Mark with only the field chapterSeverity reads. */
function mark(kind: Mark['kind']): Mark {
  return {
    markKey: `k-${kind}-${Math.random()}`,
    kind,
    ruleId: 'test',
    quote: 'q',
    rail: 'r',
    noteText: 'n',
    actions: [],
    position: { paragraphIndex: 0, occurrenceIndex: 0 },
  };
}

describe('chapterSeverity', () => {
  it('returns null for a clean chapter (no marks)', () => {
    expect(chapterSeverity([])).toBeNull();
  });

  it("returns 'yellow' when only unrecorded (missing) marks are present", () => {
    expect(chapterSeverity([mark('missing')])).toBe('yellow');
    expect(chapterSeverity([mark('missing'), mark('missing')])).toBe('yellow');
  });

  it("returns 'red' when any conflict is present", () => {
    expect(chapterSeverity([mark('conflict')])).toBe('red');
  });

  it("returns 'red' when a conflict is present alongside missing marks (conflict dominates)", () => {
    // Order-independent: conflict must win even when it is not first.
    expect(chapterSeverity([mark('missing'), mark('conflict')])).toBe('red');
    expect(chapterSeverity([mark('conflict'), mark('missing')])).toBe('red');
  });
});
