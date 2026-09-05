// F6-S6b — pure trash-countdown decision for the recently-deleted panel. Given
// an entry's deleted_at and the current clock, decide whether it is already
// purgeable and, if not, how many whole days remain before it becomes purgeable.
// The panel row is a dumb consumer of this; the retention boundary itself is
// owned by isPurgeable/RETENTION_MS (retention.ts), so this only translates the
// remaining-time into the "purges in N days" label.
//
// Mutation-locked lines:
//  * `Math.ceil` — swap to floor and a partial day rounds DOWN, so "6d+1ms ago"
//    reports 0 days left instead of 1 -> the round-UP test goes RED.
//  * `Math.max(0, ...)` — drop it and a long-elapsed entry reports NEGATIVE days
//    left -> the "never negative" test goes RED.
//  * delegating `purgeable` to isPurgeable — the boundary is proven in
//    retention.test.ts; here the boundary test locks that this helper reflects it.

import { isPurgeable, RETENTION_MS } from "@/lib/wiki/retention";

export interface TrashCountdown {
  /** True once the entry has sat in the trash for the full retention window. */
  purgeable: boolean;
  /** Whole days remaining until purgeable (0 once purgeable; rounds partial days up). */
  daysLeft: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Decide the trash-panel countdown for one soft-deleted entry (F6-S6b).
 *
 * Pure and clock-injected (caller passes `nowMs`) so the boundary is
 * deterministic and unit-testable. `daysLeft` rounds UP (a partial day still
 * reads as a day remaining) and never goes negative once the window elapses.
 */
export function trashCountdown(deletedAt: number, nowMs: number): TrashCountdown {
  const purgeable = isPurgeable(deletedAt, nowMs);
  const remainingMs = deletedAt + RETENTION_MS - nowMs;
  const daysLeft = Math.max(0, Math.ceil(remainingMs / DAY_MS));
  return { purgeable, daysLeft };
}
