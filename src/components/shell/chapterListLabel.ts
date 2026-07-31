/**
 * Display-only label for blank chapter titles.
 * Never persist these strings into chapter.title.
 */
export function chapterListLabel(
  chapters: readonly { title: string }[],
  index: number,
): string {
  const stored = chapters[index]?.title.trim() ?? ''
  if (stored) return stored
  let amongEmpty = 0
  for (let i = 0; i <= index; i++) {
    if (!(chapters[i]?.title.trim())) amongEmpty += 1
  }
  return amongEmpty <= 1 ? 'Untitled' : `Untitled ${amongEmpty}`
}
