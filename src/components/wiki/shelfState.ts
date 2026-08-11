/* Pure view-state helpers for a wiki Shelf group. Extracted so the
   empty-category decision is unit-testable in the node test env (the repo has
   no DOM test environment; wiki DOM behavior is covered by Playwright e2e). */

/** True when a category has no entries. Drives the lighter empty-category
 *  treatment in Shelf.tsx (dimmed heading + a real-text "No entries yet" hint)
 *  while the Rename / options / delete controls stay available so the user can
 *  still remove an empty category. */
export function isEmptyCategory(entryCount: number): boolean {
  return entryCount === 0;
}
