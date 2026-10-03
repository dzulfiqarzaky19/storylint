export type ChapterSeverity = 'red' | 'yellow' | null;

// Second of two independent guards: loadChapterMarks already nulls the open
// chapter's severity. Each masks the other, so only a unit test can prove this one.
export function shouldShowChapterDot(
  severity: ChapterSeverity | undefined,
  chapterNumber: number,
  selectedNumber: number,
): boolean {
  return severity != null && chapterNumber !== selectedNumber;
}
