/**
 * Binding golden — cross-chapter severity semantics (Feature 1, Q1).
 *
 * The Write index computes a per-chapter dot by running the SAME pure engine
 * over each chapter's body, applying the ONE book-wide resolvedMarkKeys set to
 * every chapter (markKey is content-hashed: sha1(ruleId|normalizedQuote|entryId),
 * NOT chapter-scoped — index.ts:100). This test locks two consequences the
 * coordinator+reviewer signed off on:
 *
 *   1. Two chapters carrying the SAME contradicting text share the same conflict
 *      markKeys, so resolving those keys clears the RED dot in BOTH chapters at
 *      once (book-wide resolution is by design).
 *   2. Two chapters carrying DIFFERENT contradictions do NOT cross-clear:
 *      resolving chapter A's conflict keys leaves chapter B still RED.
 *
 * The per-chapter derive modelled here is EXACTLY what write/page.tsx does:
 *   severityForBody(body, resolved) = chapterSeverity(
 *     checkManuscript({ paragraphs: body, wiki, resolvedMarkKeys: resolved }).marks
 *   )
 * Keeping the model here (not importing the async server component) tests the
 * semantics directly; page.tsx wiring is covered by tsc + the build gate.
 */

import { describe, it, expect } from 'vitest';
import { checkManuscript } from '@/lib/check';
import { chapterSeverity } from '@/lib/check/severity';
import { wiki, chapter7Paragraphs } from './fixtures';

/** The exact per-chapter derive the page performs, with book-wide resolved. */
function severityForBody(
  paragraphs: string[],
  resolvedMarkKeys: string[],
): 'red' | 'yellow' | null {
  const { marks } = checkManuscript({ paragraphs, wiki, resolvedMarkKeys });
  return chapterSeverity(marks);
}

/** Conflict markKeys the engine emits for a given body (unresolved run). */
function conflictKeys(paragraphs: string[]): string[] {
  const { marks } = checkManuscript({ paragraphs, wiki });
  return marks.filter((m) => m.kind === 'conflict').map((m) => m.markKey);
}

describe('chapter severity — book-wide resolution (Q1 semantics)', () => {
  it('two chapters with the SAME conflicting text both start RED', () => {
    // Chapter 7 carries m1 + m4 (two conflicts) plus m2/m3 (missing).
    expect(severityForBody(chapter7Paragraphs, [])).toBe('red');
  });

  it('resolving the shared conflict keys clears RED in BOTH chapters together', () => {
    // Both chapters are literally the same manuscript text, so they produce the
    // SAME conflict markKeys. Resolving those keys book-wide must drop BOTH from
    // RED. Chapter 7 still has m2/m3 (missing), so RED -> YELLOW in both.
    const chapterA = chapter7Paragraphs;
    const chapterB = chapter7Paragraphs;

    const resolved = conflictKeys(chapter7Paragraphs);
    expect(resolved.length).toBe(2); // m1 + m4

    expect(severityForBody(chapterA, resolved)).toBe('yellow');
    expect(severityForBody(chapterB, resolved)).toBe('yellow');
  });

  it('resolving DIFFERENT chapters\u2019 conflicts does NOT cross-clear', () => {
    // Chapter A = the seeded manuscript (conflicts m1 "nineteen and sworn" + m4).
    // Chapter B = a DIFFERENT contradiction (wrong Sept member count), which has
    // its own distinct markKey. Resolving A's keys must leave B RED.
    const chapterA = chapter7Paragraphs;
    const chapterB = ['The Sept had twenty-three members that winter, never more.'];

    const resolvedFromA = conflictKeys(chapterA);
    // Sanity: A's keys and B's key are disjoint (different quote/entity).
    const bKeys = conflictKeys(chapterB);
    expect(bKeys.length).toBe(1);
    expect(resolvedFromA).not.toContain(bKeys[0]);

    // A clears (only had the two now-resolved conflicts + its missing marks).
    expect(severityForBody(chapterA, resolvedFromA)).toBe('yellow');
    // B is untouched by A's resolution: still RED.
    expect(severityForBody(chapterB, resolvedFromA)).toBe('red');
  });

  it('a clean chapter shows NO dot (null) regardless of others\u2019 resolutions', () => {
    // A consistent manuscript names/contradicts nothing -> zero marks -> null.
    const consistent = [
      'Maren had kept the Verge Light since Chapter 1, and it burned tallow the way it always had.',
      'She was nineteen, and the Sept had twenty-one members, never more.',
    ];
    expect(severityForBody(consistent, [])).toBeNull();
    // Even with unrelated keys resolved, still null.
    expect(severityForBody(consistent, conflictKeys(chapter7Paragraphs))).toBeNull();
  });
});
