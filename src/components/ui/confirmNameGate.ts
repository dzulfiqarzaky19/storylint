/* Pure gate for the "type-the-name to confirm" delete flow on the /wiki/manage
   screen. Extracted (mirrors nameGate.ts) so the "may this delete be confirmed?"
   decision is unit-testable in the node env — no React/DOM types leak in here so
   it runs under `environment: 'node'`. The manage-screen wiring that consumes it
   is covered by the Firefox / playwright browser drive, same split as
   nameGate.ts / shelfState.ts. */

/** True when the writer has typed the target's EXACT name (both sides trimmed),
 *  and therefore may confirm the destructive delete. Trimming forgives only
 *  leading/trailing whitespace; the interior must match character-for-character
 *  (case-sensitive), so a near-miss like "ashkeld" for "Ashkeld" stays disabled.
 *  An empty target name can never be matched (guards against a blank name
 *  auto-arming the confirm). */
export function matchesDeleteName(typed: string, target: string): boolean {
  const t = target.trim();
  if (t.length === 0) return false;
  return typed.trim() === t;
}
