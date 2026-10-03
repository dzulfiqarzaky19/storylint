export function isEmptyCategory(entryCount: number): boolean {
  return entryCount === 0;
}

export type RenameOutcome =
  | { action: "reset" }
  | { action: "rename"; label: string }
  | { action: "noop" };

export function resolveRename(draft: string, currentTitle: string): RenameOutcome {
  if (draft.trim() === "") return { action: "reset" };
  if (draft.trim() !== currentTitle) return { action: "rename", label: draft };
  return { action: "noop" };
}

export function initialCollapse(categoryIds: string[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const id of categoryIds) map[id] = false;
  return map;
}
