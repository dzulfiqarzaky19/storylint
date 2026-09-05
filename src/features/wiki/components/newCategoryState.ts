// TCK-019: the pure decision behind the "New category" popup's Add action,
// extracted so it can be unit-tested in the node harness (the modal itself
// can't be rendered under vitest environment:'node'). Mirrors the TCK-018
// shelfState precedent: JSX calls the same exported fn it asserts on.
//
// The idempotency contract this encodes (TCK-010): the caller mints ONE client
// id when the popup opens and passes it in on every commit of that open. A
// single click can fire the submit handler twice; because both commits carry
// the SAME `mintedId`, the server INSERT ON CONFLICT DO NOTHING collapses them
// to a single category row. resolveNewCategory therefore always echoes the id
// it was given (it never mints its own), so two commits of one open produce two
// create outcomes bearing the identical id.

export type NewCategoryOutcome =
  | { action: "create"; id: string; label: string }
  | { action: "noop" };

/**
 * Decide what a "New category" Add commit should do.
 *
 * - A blank (empty or whitespace-only) label is a no-op: nothing is created,
 *   the popup just closes.
 * - A non-blank label creates a category with the TRIMMED label, keyed by the
 *   caller-supplied `mintedId` (echoed verbatim — never re-minted here), so a
 *   double-invoked commit reuses one id and dedupes to a single row.
 */
export function resolveNewCategory(
  label: string,
  mintedId: string,
): NewCategoryOutcome {
  const trimmed = label.trim();
  if (trimmed === "") return { action: "noop" };
  return { action: "create", id: mintedId, label: trimmed };
}
