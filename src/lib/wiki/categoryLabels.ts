import type { Kind } from "@/lib/domain/types";
import { KIND_SHELF, SHELF_TITLES } from "@/lib/domain/types";

/**
 * A per-kind display-name override map (from the `category_labels` table). A kind
 * absent from the map has no custom label and falls back to its shelf default.
 * Partial on purpose: only renamed categories have a row.
 */
export type CategoryLabelOverrides = Partial<Record<Kind, string>>;

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
