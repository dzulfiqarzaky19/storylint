import type { ResolvedTie } from "@/lib/domain/types";

/**
 * The result of resolving one tie against the set of live (non-deleted) entries.
 * A tie is "tombstoned" when its target entry is no longer live — either
 * soft-deleted (its row still exists but is filtered out of every live read) or
 * hard-gone (purged). Either way the tie survives on the source entry and must
 * render as a RED "removed — needs replacement" marker instead of a live link.
 */
export interface ResolvedDanglingTie {
  tie: ResolvedTie;
  /** True when the tie points at an entry that is no longer live. */
  tombstoned: boolean;
  /** The removed target's display name (carried on the tie's JOIN), when tombstoned. */
  removedName?: string;
}

/**
 * Pure dangling-reference resolver (F6-S2, THE core lock).
 *
 * Given the ids of every LIVE entry and a list of ties, decide per tie whether
 * its target is still live. Membership — not a deleted_at flag — is the test on
 * purpose: it tombstones ANY absent target, so it Just Works for both
 * soft-delete (target filtered out of live reads) AND a future hard-purge (row
 * truly gone). One mechanism covers both.
 *
 * Pure and non-mutating; no DB access. The surviving (source) entry is always
 * tie.fromEntryId — we only ever render ties that hang off a live entry.
 */
export function resolveDanglingTies(
  liveEntryIds: Set<string>,
  ties: ResolvedTie[],
): ResolvedDanglingTie[] {
  return ties.map((tie) => {
    const tombstoned = !liveEntryIds.has(tie.toEntryId);
    return tombstoned
      ? { tie, tombstoned: true, removedName: tie.toName }
      : { tie, tombstoned: false };
  });
}
