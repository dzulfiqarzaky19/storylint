/**
 * The left-index dot's RENDER guard.
 *
 * Deriving a chapter's severity is not here: that is one step of resolving a
 * chapter's marks, and it lives inside `lib/write/chapterMarks.ts` with the
 * resolution it belongs to (it was split out for testability and, being
 * reachable, promptly grew a second copy of the freshness gate beside it).
 *
 * What stays is the guard the client renders through, which is the SECOND of
 * two independent guards: `loadChapterMarks` already maps the active chapter to
 * null. Each is defensible on its own, and because they double-cover, only a
 * test that drops ONE in isolation can prove that one — an e2e cannot, since
 * the other masks it. Dropping the `!== selectedNumber` term makes an active
 * chapter with a severity render a dot.
 */

/** A left-index dot severity, or null for a clean chapter (no dot). */
export type ChapterSeverity = 'red' | 'yellow' | null;

/** A dot renders iff the chapter has a severity AND it is not the active one. */
export function shouldShowChapterDot(
  severity: ChapterSeverity | undefined,
  chapterNumber: number,
  selectedNumber: number,
): boolean {
  return severity != null && chapterNumber !== selectedNumber;
}
