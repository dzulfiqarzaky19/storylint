import { one, query, rows } from "@/server/db/pool";
import { fromEpochMs } from "@/server/db/sql";
import { CATEGORY_COLS } from "@/server/db/gazetteer/reads";
import { type CategoryRow, type Shelf, SHELF_TITLES } from "@/domain/types";
import { type WikiWriteConfirmation } from "@/domain/result";

export async function getMaxCategorySortOrder(): Promise<number> {
  const res = await rows<{ maxSort: number | null }>(
    `SELECT MAX(sort_order) AS "maxSort" FROM categories WHERE deleted_at IS NULL`,
  );
  return (res[0]?.maxSort ?? -1) + 1;
}

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
     RETURNING ${CATEGORY_COLS}`,
    [input.id, label, input.shelf, input.sortOrder],
  );
  if (!res) {
    const existing = await one<CategoryRow>(
      `SELECT ${CATEGORY_COLS} FROM categories WHERE id = $1`,
      [input.id],
    );
    if (!existing) throw new Error("createCategory: no row returned");
    return existing;
  }
  return res;
}

export async function renameCategory(input: {
  kind: string;
  label: string;
}): Promise<void> {
  const label = input.label.trim();
  if (label === "") return;
  await query(
    `UPDATE categories SET label = $2 WHERE id = $1`,
    [input.kind, label],
  );
}

export async function resetCategoryLabel(kind: string): Promise<void> {
  const cat = await one<{ shelf: string; isBuiltin: boolean }>(
    `SELECT shelf, is_builtin AS "isBuiltin" FROM categories WHERE id = $1`,
    [kind],
  );
  if (!cat || !cat.isBuiltin) return;
  const shelfDefault = SHELF_TITLES[cat.shelf as Shelf];
  if (shelfDefault === undefined) return;
  await query(`UPDATE categories SET label = $2 WHERE id = $1`, [kind, shelfDefault]);
}

export async function deleteCategory(
  input: { kind: string; deletedAt: number },
  _confirmation: WikiWriteConfirmation,
): Promise<number> {
  const res = await query(
    `UPDATE entries SET deleted_at = ${fromEpochMs("$2")}
      WHERE category_id = $1 AND deleted_at IS NULL`,
    [input.kind, input.deletedAt],
  );
  await query(
    `UPDATE categories SET deleted_at = ${fromEpochMs("$2")}
      WHERE id = $1 AND is_builtin = false AND deleted_at IS NULL`,
    [input.kind, input.deletedAt],
  );
  return res.rowCount ?? 0;
}

