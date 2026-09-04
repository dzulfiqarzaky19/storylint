// =============================================================================
// Editing the world skeleton — the shared vocabulary (T-DEEP-7).
//
// Types and messages only: `editWorldStructure` is a "use server" module and may
// export nothing but async functions, so the shapes its callers construct — and
// the refusal messages both sides must agree on — live here.
// =============================================================================

/** A level of the universe -> world -> book skeleton. */
export type StructureLevel = "universe" | "world" | "book";

/**
 * One structural edit. Deliberately absent from every arm: the minted ids, which
 * path must be revalidated afterwards, and the last-child guard.
 */
export type StructureEdit =
  | { op: "create"; level: "universe"; name: string }
  | { op: "create"; level: "world"; name: string; universeId?: string }
  | { op: "create"; level: "book"; name: string; worldId: string }
  | { op: "rename"; level: StructureLevel; id: string; name: string }
  | { op: "delete"; level: StructureLevel; id: string; confirmed: true };

/**
 * THE last-child rule, in the words both the refusal and the tooltip use.
 *
 * A universe with no world orphans every shared entity, leaving no world to
 * reclaim it in; a world with no book leaves its chapters homeless. The rule was
 * enforced ONLY by disabling a button in two different screens, while the server
 * action's doc comment asked the caller to please not do it. Now the server
 * refuses and the screens read the reason from here, so the two cannot disagree
 * about when — or why — a delete is blocked.
 */
export const LAST_CHILD_BLOCK: Record<"world" | "book", string> = {
  world: "A universe must keep at least one world",
  book: "A world must keep at least one book",
};

/**
 * The client-side hint for the same rule: a reason to disable the affordance, or
 * null when the delete is allowed. ADVISORY — the server enforces it for real.
 */
export function lastChildHint(
  level: StructureLevel,
  siblingCount: number,
): string | null {
  if (level === "universe") return null;
  return siblingCount > 1 ? null : LAST_CHILD_BLOCK[level];
}
