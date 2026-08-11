/* Pure focus-trap helpers for the base Modal primitive. Extracted so the
   Tab / Shift-Tab wraparound decision is unit-testable in the node test env
   (the repo has no DOM test environment; the DOM wiring in Modal.tsx is covered
   by a Firefox drive, same split as shelfState.ts). No DOM types leak in here:
   the decision is expressed in plain indices so it runs under `environment:
   'node'`. */

/**
 * Which focusable element the dialog should move focus to next, given a
 * Tab / Shift-Tab keypress. This is the whole trap decision, kept pure:
 *
 * @param count   how many focusable elements the dialog currently has
 * @param current index of the element focused now, or -1 when focus is not on
 *                any of them (e.g. focus escaped to the body)
 * @param shift   whether Shift was held (Shift-Tab moves backward)
 * @returns the index to focus next, with wraparound (last -> first on Tab,
 *          first -> last on Shift-Tab), or -1 when there is nothing to focus.
 *
 * Wraparound is what makes it a trap: Tab off the last element returns to the
 * first, Shift-Tab off the first returns to the last, so focus can never leave
 * the dialog while it is open.
 */
export function nextFocusIndex(
  count: number,
  current: number,
  shift: boolean,
): number {
  if (count <= 0) return -1;
  // Focus outside the dialog: Tab enters at the top, Shift-Tab at the bottom.
  if (current < 0) return shift ? count - 1 : 0;
  // Modulo gives the wraparound for both directions in one expression:
  // forward is +1, backward is +(count - 1) === -1 mod count.
  const step = shift ? count - 1 : 1;
  return (current + step) % count;
}
