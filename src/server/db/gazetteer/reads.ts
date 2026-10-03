import { rows, one } from "../pool";
import { epochMs } from "../sql";
import type { EntryRow, CategoryRow } from "@/domain/types";

// Unqualified column names: usable in any query where `entries` is the only
// table that has them (world_entries, the usual join, shares none).
export const ENTRY_COLS = `
  id,
  category_id AS kind,
  name,
  catalogue_no AS "catalogueNo",
  note,
  summary,
  shelf,
  sort_order AS "sortOrder",
  ${epochMs("deleted_at")} AS "deletedAt"
`;

export const FACT_COLS = `
  id,
  entry_id AS "entryId",
  key,
  value,
  fresh,
  sort_order AS "sortOrder"
`;

export const CATEGORY_COLS = `
  id,
  label,
  shelf,
  sort_order AS "sortOrder",
  is_builtin AS "isBuiltin",
  ${epochMs("deleted_at")} AS "deletedAt"
`;

export async function getWorldEntries(worldId: string): Promise<EntryRow[]> {
  return rows<EntryRow>(
    `SELECT ${ENTRY_COLS} FROM entries
       JOIN world_entries we ON we.entry_id = id AND we.world_id = $1
      WHERE deleted_at IS NULL AND category_id <> 'plotline'
      ORDER BY shelf, sort_order, name`,
    [worldId],
  );
}

export async function getEntry(id: string): Promise<EntryRow | null> {
  return one<EntryRow>(
    `SELECT ${ENTRY_COLS} FROM entries WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
}

export async function getEntryUniverseId(id: string): Promise<string | null> {
  const row = await one<{ universeId: string }>(
    `SELECT universe_id AS "universeId" FROM entries WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return row?.universeId ?? null;
}

export async function getDeletedEntries(): Promise<EntryRow[]> {
  return rows<EntryRow>(
    `SELECT ${ENTRY_COLS} FROM entries
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC`,
  );
}

export async function getCategories(): Promise<CategoryRow[]> {
  return rows<CategoryRow>(
    `SELECT ${CATEGORY_COLS} FROM categories
      WHERE deleted_at IS NULL AND shelf <> 'plots'
      ORDER BY sort_order, id`,
  );
}
