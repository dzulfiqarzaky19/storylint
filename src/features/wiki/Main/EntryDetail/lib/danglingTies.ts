import type { ResolvedTie } from "@/domain/types";

export interface ResolvedDanglingTie {
  tie: ResolvedTie;
  tombstoned: boolean;
  removedName?: string;
}

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
