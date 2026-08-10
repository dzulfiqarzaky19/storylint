// F6-S6a — pure purge-retention policy. This is the ONE place the ">7d" purge
// boundary is decided, so it carries the mutation lock for the purge slice.
//
// A soft-deleted entry (deleted_at stamped) becomes permanently purgeable only
// after it has sat in the trash for at least RETENTION_MS. The comparison is
// INCLUSIVE (>=): an entry deleted exactly RETENTION_MS ago IS purgeable.
//
// Mutation-locked lines in isPurgeable:
//  * the null guard `deletedAt == null` — drop it and a live (never-deleted)
//    entry would be reported purgeable -> the "live entry is never purgeable"
//    test goes RED.
//  * the boundary `>=` — weaken it to `>` and the exactly-RETENTION_MS case
//    flips to not-purgeable -> the "exactly 7d is purgeable" test goes RED.
//  * RETENTION_MS itself — change the constant and the 6d59m/7d01m boundary
//    tests straddle the wrong line -> RED.

/** Trash retention window: entries soft-deleted longer than this are purgeable. */
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Pure purge-eligibility decision (F6-S6a, THE >7d lock).
 *
 * An entry is purgeable iff it is soft-deleted (`deletedAt` is a real timestamp,
 * not null) AND it has been deleted for at least `retentionMs` as measured
 * against `nowMs`. Inclusive boundary: `nowMs - deletedAt >= retentionMs`.
 *
 * Pure and non-mutating; no DB access, no clock read (caller passes `nowMs`), so
 * the boundary is deterministic and unit-testable. The single decision the purge
 * action and the trash-countdown UI both route through.
 */
export function isPurgeable(
  deletedAt: number | null,
  nowMs: number,
  retentionMs: number = RETENTION_MS,
): boolean {
  if (deletedAt == null) return false;
  return nowMs - deletedAt >= retentionMs;
}
