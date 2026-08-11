/* Pure name-gate for WorldSwitcher's naming dialog (create universe/series/book).
   Extracted so the "may this name be submitted?" decision is unit-testable in the
   node test env (the repo has no DOM test environment; the dialog wiring in
   WorldSwitcher.tsx is covered by a Firefox drive, same split as shelfState.ts
   and focusTrap.ts). No React/DOM types leak in here so it runs under
   `environment: 'node'`. */

/** True when `value` trims to a non-empty name and may therefore create a world.
 *  This is the single safety net: the naming dialog's Create button `disabled`
 *  AND its form-submit guard both key off this, so an empty or whitespace-only
 *  name can never be submitted (via click OR Enter). */
export function canSubmitName(value: string): boolean {
  return value.trim().length > 0;
}
