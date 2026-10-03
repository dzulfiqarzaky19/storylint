export type StructureLevel = "universe" | "world" | "book";

export type StructureEdit =
  | { op: "create"; level: "universe"; name: string }
  | { op: "create"; level: "world"; name: string; universeId: string }
  | { op: "create"; level: "book"; name: string; worldId: string }
  | { op: "rename"; level: StructureLevel; id: string; name: string }
  | { op: "delete"; level: StructureLevel; id: string; confirmed: true };

export const LAST_CHILD_BLOCK: Record<"world" | "book", string> = {
  world: "A universe must keep at least one world",
  book: "A world must keep at least one book",
};

export function lastChildHint(
  level: StructureLevel,
  siblingCount: number,
): string | null {
  if (level === "universe") return null;
  return siblingCount > 1 ? null : LAST_CHILD_BLOCK[level];
}
