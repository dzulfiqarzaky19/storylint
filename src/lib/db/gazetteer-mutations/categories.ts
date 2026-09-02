// ============================================================================
// Category write helpers (F9-B category_labels)
// Split out of the former monolithic gazetteer-mutations.ts (T-ARCH-12). Product
// rule 1 (WikiWriteConfirmation token) and all SQL are unchanged; only file
// boundaries moved.
// ============================================================================

import { one, query, rows } from "../pool";
import { type CategoryRow, type Shelf, SHELF_TITLES } from "../../domain/types";
import { type WikiWriteConfirmation } from "../../actions/confirmation";

/**
 * The next free sort_order for a new category (max over LIVE categories + 1, or 0
 * if none). A new user category sorts AFTER every existing one, so it appends to
 * the end of the header list rather than colliding with a built-in's position.
 */
export async function getMaxCategorySortOrder(): Promise<number> {
  const res = await rows<{ maxSort: number | null }>(
    `SELECT MAX(sort_order) AS "maxSort" FROM categories WHERE deleted_at IS NULL`,
  );
  return (res[0]?.maxSort ?? -1) + 1;
}

/**
 * Create a new user category. TRIMS the label; a blank/whitespace-only label is
 * rejected (a category with no header is meaningless) — the caller owns surfacing
 * that. `isBuiltin` is always false (only the 4 seeded rows are built-in) and
 * `deleted_at` starts NULL (live). Idempotent on the id (ON CONFLICT DO NOTHING)
 * so a retried create never PK-violates or clobbers an existing category's label.
 * Returns the created row (camelCase). No token: an empty category is not wiki
 * knowledge (product rule 1 does not apply).
 */
export async function createCategory(input: {
  id: string;
  label: string;
  shelf: Shelf;
  sortOrder: number;
}): Promise<CategoryRow> {
  const label = input.label.trim();
  if (label === "") throw new Error("createCategory: label must be non-empty");
  const res = await one<CategoryRow>(
    `INSERT INTO categories (id, label, shelf, sort_order, is_builtin, deleted_at)
     VALUES ($1, $2, $3, $4, false, NULL)
     ON CONFLICT (id) DO NOTHING
     RETURNING id,
               label,
               shelf,
               sort_order AS "sortOrder",
               is_builtin AS "isBuiltin",
               deleted_at::double precision AS "deletedAt"`,
    [input.id, label, input.shelf, input.sortOrder],
  );
  if (!res) {
    // ON CONFLICT DO NOTHING returns no row when the id already existed; fetch it
    // so a retry is idempotent (returns the existing category, not an error).
    const existing = await one<CategoryRow>(
      `SELECT id, label, shelf, sort_order AS "sortOrder",
              is_builtin AS "isBuiltin", deleted_at::double precision AS "deletedAt"
         FROM categories WHERE id = $1`,
      [input.id],
    );
    if (!existing) throw new Error("createCategory: no row returned");
    return existing;
  }
  return res;
}

/**
 * Set (rename) a category's display label. UPDATEs the categories row in place.
 * TRIMS the input and treats an empty/whitespace-only label as a no-op (never
 * writes a blank, which would render a BLANK header). Use resetCategoryLabel to
 * restore a built-in's shelf default. No token: touches no wiki entry/fact/tie.
 */
export async function renameCategory(input: {
  kind: string;
  label: string;
}): Promise<void> {
  const label = input.label.trim();
  if (label === "") return; // blank rename is a no-op, not a blanked header
  await query(
    `UPDATE categories SET label = $2 WHERE id = $1`,
    [input.kind, label],
  );
}

/**
 * Reset a category header to its default. For a built-in category the default is
 * its shelf title (SHELF_TITLES[shelf]); the row's `label` is set back to that.
 * Reads the category's shelf first so the correct default is restored, and only
 * writes when the category is a built-in (a user category has no shelf default,
 * so reset is a harmless no-op for it). Idempotent. No token (same rationale as
 * renameCategory).
 */
export async function resetCategoryLabel(kind: string): Promise<void> {
  const cat = await one<{ shelf: string; isBuiltin: boolean }>(
    `SELECT shelf, is_builtin AS "isBuiltin" FROM categories WHERE id = $1`,
    [kind],
  );
  if (!cat || !cat.isBuiltin) return; // unknown or user category: nothing to reset
  const shelfDefault = SHELF_TITLES[cat.shelf as Shelf];
  if (shelfDefault === undefined) return; // non-standard shelf: no default to restore
  await query(`UPDATE categories SET label = $2 WHERE id = $1`, [kind, shelfDefault]);
}

/**
 * "Delete" a category: SOFT-delete every LIVE entry of that category in one pass,
 * so their ties/references render the existing S2 "removed" tombstones, AND
 * soft-delete the category ROW itself (TCK-008) so an EMPTY user category still
 * disappears and a populated one leaves no empty shelf. The ROW soft-delete is
 * GUARDED to is_builtin = false: the 4 seeded built-in categories are never
 * deletable, so their entries tombstone but the shelf persists. Reuses the S2
 * soft-delete semantics: stamp `deleted_at` WITHOUT removing rows, guarded by
 * `deleted_at IS NULL` so re-running preserves the original timestamps
 * (idempotent) for BOTH the entries and the category row. REQUIRES a
 * confirmation token — it is a bulk, high-consequence soft-delete. Returns the
 * number of ENTRIES soft-deleted (the row side effect is not counted).
 */
export async function deleteCategory(
  input: { kind: string; deletedAt: number },
  _confirmation: WikiWriteConfirmation,
): Promise<number> {
  const res = await query(
    `UPDATE entries SET deleted_at = $2 WHERE kind = $1 AND deleted_at IS NULL`,
    [input.kind, input.deletedAt],
  );
  // TCK-008: ALSO soft-delete the category ROW itself, so an EMPTY user category
  // (0 entries -> the entries UPDATE above matches nothing) still disappears, and
  // a populated one does not leave an empty shelf behind. id = input.kind holds
  // because a category id EQUALS the kind its entries carry (schema.sql:48-50).
  // GUARDS: is_builtin = false protects the 4 seeded categories (never deletable
  // — their shelf must persist); deleted_at IS NULL keeps the stamp idempotent so
  // a re-run preserves the first deletion timestamp.
  await query(
    `UPDATE categories SET deleted_at = $2
      WHERE id = $1 AND is_builtin = false AND deleted_at IS NULL`,
    [input.kind, input.deletedAt],
  );
  return res.rowCount ?? 0;
}

// ---- Manual authoring (Track A — edit in place) ---------------------------
// WIKI WRITE (product rule 1). Editing an existing entry/fact changes the wiki,
// so both helpers require a WikiWriteConfirmation token. A manual edit is
// inherently confirmed (the user typed and saved it), so the action layer mints
// the token via confirmWikiWrite({ confirmed: true }). Each builds a partial
// UPDATE from only the provided fields, parameterized. No existing helper is
// modified.
