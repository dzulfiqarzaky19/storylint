export type NewCategoryOutcome =
  | { action: "create"; id: string; label: string }
  | { action: "noop" };

export function resolveNewCategory(
  label: string,
  mintedId: string,
): NewCategoryOutcome {
  const trimmed = label.trim();
  if (trimmed === "") return { action: "noop" };
  return { action: "create", id: mintedId, label: trimmed };
}
