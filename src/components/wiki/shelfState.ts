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

/** TCK-005 — build the sidebar's initial per-category collapse map from the
 *  live category ids. Every group starts EXPANDED (value `false`) so the whole
 *  world is scannable at a glance, matching the previous hardcoded-4 default.
 *  Pure and keyed by category id (built-in Kind strings or user UUIDs), so a
 *  newly-created category is expanded when it first appears. */
export function initialCollapse(categoryIds: string[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const id of categoryIds) map[id] = false;
  return map;
}
