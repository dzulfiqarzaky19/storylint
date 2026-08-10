import type { EntryWithDetails, ResearchScope } from "@/lib/domain/types";

/**
 * Select the wiki entries the AI is allowed to see for a research thread's scope.
 *
 * - `'chat'`  -> no wiki context at all (broad conversation), returns `[]`.
 * - a `Kind`  -> only the entries of that kind.
 *
 * Pure and non-mutating: always returns a new array (F4-P2-S1).
 */
export function filterGazetteerEntries(
  entries: EntryWithDetails[],
  scope: ResearchScope,
): EntryWithDetails[] {
  if (scope === "chat") return [];
  return entries.filter((e) => e.kind === scope);
}
