import type { Kind, CategoryLabelOverrides, CategoryRow, Shelf } from "@/domain/types";
import { KIND_SHELF, SHELF_TITLES } from "@/domain/types";

export type { CategoryLabelOverrides };

export function resolveCategoryLabel(
  kind: Kind,
  overrides: CategoryLabelOverrides,
): string {
  const override = overrides[kind];
  if (override !== undefined && override.trim() !== "") return override;
  return SHELF_TITLES[KIND_SHELF[kind]];
}

export function applyCategoryRename(
  overrides: CategoryLabelOverrides,
  kind: Kind,
  label: string,
): CategoryLabelOverrides {
  const trimmed = label.trim();
  const next = { ...overrides };
  if (trimmed === "") delete next[kind];
  else next[kind] = trimmed;
  return next;
}

export function applyCategoryReset(
  overrides: CategoryLabelOverrides,
  kind: Kind,
): CategoryLabelOverrides {
  const next = { ...overrides };
  delete next[kind];
  return next;
}

export function categoryLabelById(categories: CategoryRow[], id: string): string {
  const row = categories.find((c) => c.id === id);
  if (row) return row.label;
  if (id in KIND_SHELF) return SHELF_TITLES[KIND_SHELF[id as Kind]];
  return id;
}

export function categorySingular(label: string): string {
  return label.replace(/s$/, "").toLowerCase();
}

export function defaultCategoryShelf(): Shelf {
  return "lore";
}
