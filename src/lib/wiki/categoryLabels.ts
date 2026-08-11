import type { Kind, CategoryLabelOverrides, CategoryRow } from "@/lib/domain/types";
import { KIND_SHELF, SHELF_TITLES } from "@/lib/domain/types";

export type { CategoryLabelOverrides };

/**
 * Pure category-header resolver (F6-S5, THE label lock).
 *
 * Decide the header text for a category `kind`: the writer's custom override when
 * one exists AND is non-empty, otherwise the fixed shelf default (SHELF_TITLES via
 * KIND_SHELF). A whitespace-only or empty override is treated as ABSENT so a blank
 * rename never blanks the header — the default always shows through.
 *
 * Pure and non-mutating; no DB access. The single decision the read path and the
 * reducer both route through, so the coalesce lives in exactly one place.
 */
export function resolveCategoryLabel(
  kind: Kind,
  overrides: CategoryLabelOverrides,
): string {
  const override = overrides[kind];
  if (override !== undefined && override.trim() !== "") return override;
  return SHELF_TITLES[KIND_SHELF[kind]];
}

/**
 * Pure session-state rename (F6-S5b). Return a NEW overrides map with `kind`
 * renamed to the trimmed `label`. A blank/whitespace label is a reset: the key
 * is REMOVED so the header falls back to the shelf default, never stored as a
 * dead blank. Mirrors the backend renameCategory trim/no-op ruling so the
 * optimistic session and the DB agree. Non-mutating (input map untouched).
 */
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

/**
 * Pure session-state reset (F6-S5b). Return a NEW overrides map with `kind`'s
 * custom label removed, so the header falls back to the shelf default. Mirrors
 * the backend resetCategoryLabel. Non-mutating; idempotent if no override.
 */
export function applyCategoryReset(
  overrides: CategoryLabelOverrides,
  kind: Kind,
): CategoryLabelOverrides {
  const next = { ...overrides };
  delete next[kind];
  return next;
}

/**
 * F9-B (S2) — PURE list-based header resolver over the full category list.
 *
 * Decide the header text for a category `id` from the live `categories` list
 * (the store's single source, built-ins + user categories): the matching row's
 * `label` when the id is present, otherwise fall back to the built-in shelf
 * default (SHELF_TITLES via KIND_SHELF) when `id` is one of the 4 built-in ids,
 * else the raw id (a user category absent from the list has no built-in default,
 * so its id is the safe fallback).
 *
 * Independent of the map-based resolveCategoryLabel (kept for the current UI):
 * this reads the row list, that reads the overrides map. Pure and non-mutating;
 * no DB access.
 */
export function categoryLabelById(categories: CategoryRow[], id: string): string {
  const row = categories.find((c) => c.id === id);
  if (row) return row.label;
  if (id in KIND_SHELF) return SHELF_TITLES[KIND_SHELF[id as Kind]];
  return id;
}
