import { describe, it, expect } from 'vitest';
import {
  shouldShowChapterDot,
  buildSeverityByNumber,
  type ChapterSeverity,
} from '@/lib/check/severity';

// -----------------------------------------------------------------------------
// The two INDEPENDENT active-chapter suppression guards (Feature 1 left-index
// dots). They double-cover on purpose (belt-and-suspenders), which means NO
// single e2e mutant can redden the render: dropping either guard leaves the
// other masking it. These unit tests lock EACH guard in ISOLATION so a mutation
// that removes one guard's own logic is caught here even though the page still
// renders correctly end-to-end.
// -----------------------------------------------------------------------------

describe('shouldShowChapterDot — the render-side active guard (WriteIndex)', () => {
  it('shows a dot for a non-active chapter that has a severity', () => {
    expect(shouldShowChapterDot('red', 7, 6)).toBe(true);
    expect(shouldShowChapterDot('yellow', 6, 7)).toBe(true);
  });

  // THE GUARD THIS FILE EXISTS FOR: even with a real severity, the ACTIVE
  // chapter must not render a dot. Dropping the `!== selectedNumber` term makes
  // this return true -> RED.
  it('suppresses the dot on the ACTIVE chapter even when it has a severity', () => {
    expect(shouldShowChapterDot('red', 7, 7)).toBe(false);
    expect(shouldShowChapterDot('yellow', 6, 6)).toBe(false);
  });

  it('shows no dot when severity is null or undefined (clean chapter)', () => {
    expect(shouldShowChapterDot(null, 3, 7)).toBe(false);
    expect(shouldShowChapterDot(undefined, 3, 7)).toBe(false);
  });
});

describe('buildSeverityByNumber — the page-side active-null force', () => {
  const chapters = [
    { number: 5, body: 'clean' },
    { number: 6, body: 'yellow-body' },
    { number: 7, body: 'red-body' },
  ];
  // A deterministic stand-in for the real engine derive, keyed off the body so
  // the map's non-active entries reflect the computeFn faithfully.
  const compute = (body: unknown): ChapterSeverity => {
    if (body === 'red-body') return 'red';
    if (body === 'yellow-body') return 'yellow';
    return null;
  };

  it('computes real severities for every NON-active chapter', () => {
    const map = buildSeverityByNumber(chapters, 5, compute);
    expect(map.get(6)).toBe('yellow');
    expect(map.get(7)).toBe('red');
  });

  // THE GUARD THIS BLOCK EXISTS FOR: the ACTIVE chapter maps to null regardless
  // of what computeFn would return for its body. Removing the active-null branch
  // makes this its real severity ('red') -> RED.
  it('forces the ACTIVE chapter to null even when its body has a severity', () => {
    const map = buildSeverityByNumber(chapters, 7, compute);
    expect(map.get(7)).toBeNull();
    // and the other chapters are unaffected by the suppression
    expect(map.get(6)).toBe('yellow');
    expect(map.get(5)).toBeNull();
  });

  it('covers every chapter number exactly once', () => {
    const map = buildSeverityByNumber(chapters, 7, compute);
    expect([...map.keys()].sort((a, b) => a - b)).toEqual([5, 6, 7]);
  });
});
