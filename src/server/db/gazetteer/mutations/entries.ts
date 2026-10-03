import { query, one, withTransaction } from "@/server/db/pool";
import { fromEpochMs } from "@/server/db/sql";
import { type WikiWriteConfirmation } from "@/domain/result";

export interface NewEntry {
  id: string;
  kind: string;
  name: string;
  catalogueNo: string;
  note: string;
  summary: string;
  shelf: string;
  sortOrder: number;
}

// The entry's universe is the world's universe, read in the same statement so
// the two can never disagree. An unknown world inserts nothing.
export const INSERT_ENTRY_IN_WORLD = `
  INSERT INTO entries (id, universe_id, category_id, name, catalogue_no, note, summary, shelf, sort_order)
  SELECT $1, w.universe_id, $2, $3, $4, $5, $6, $7, $8
    FROM worlds w WHERE w.id = $9`;

export function entryParams(entry: NewEntry, worldId: string): unknown[] {
  return [
    entry.id,
    entry.kind,
    entry.name,
    entry.catalogueNo,
    entry.note,
    entry.summary,
    entry.shelf,
    entry.sortOrder,
    worldId,
  ];
}

/** Idempotent on the entry id, so a retried write-through lands on the same row. */
export async function insertEntryLinkedToWorld(
  entry: NewEntry,
  worldId: string,
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await withTransaction(async (client) => {
    const res = await client.query(
      `${INSERT_ENTRY_IN_WORLD}
       ON CONFLICT (id) DO UPDATE SET
         category_id = EXCLUDED.category_id,
         name = EXCLUDED.name,
         catalogue_no = EXCLUDED.catalogue_no,
         note = EXCLUDED.note,
         summary = EXCLUDED.summary,
         shelf = EXCLUDED.shelf,
         sort_order = EXCLUDED.sort_order`,
      entryParams(entry, worldId),
    );
    if ((res.rowCount ?? 0) === 0) throw new Error(`insertEntry: no world ${worldId}`);
    await client.query(
      `INSERT INTO world_entries (world_id, entry_id)
       VALUES ($1, $2)
       ON CONFLICT (world_id, entry_id) DO NOTHING`,
      [worldId, entry.id],
    );
  });
}

export async function softDeleteEntry(
  input: { id: string; deletedAt: number },
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await query(
    `UPDATE entries SET deleted_at = ${fromEpochMs("$2")} WHERE id = $1 AND deleted_at IS NULL`,
    [input.id, input.deletedAt],
  );
}

export async function restoreEntry(
  input: { id: string },
  _confirmation: WikiWriteConfirmation,
): Promise<number> {
  const res = await query(
    `UPDATE entries SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL`,
    [input.id],
  );
  return res.rowCount ?? 0;
}

export async function purgeDeletedBefore(
  input: { cutoffMs: number },
  _confirmation: WikiWriteConfirmation,
): Promise<number> {
  const res = await query(
    `DELETE FROM entries WHERE deleted_at < ${fromEpochMs("$1")}`,
    [input.cutoffMs],
  );
  return res.rowCount ?? 0;
}

export async function reorderShelf(input: {
  shelf: string;
  orderedIds: string[];
}): Promise<void> {
  await query(
    `UPDATE entries e SET shelf = $1, sort_order = o.ord - 1
       FROM UNNEST($2::text[]) WITH ORDINALITY AS o(id, ord)
      WHERE e.id = o.id`,
    [input.shelf, input.orderedIds],
  );
}

export async function getMaxSortOrderForShelf(shelf: string): Promise<number> {
  const res = await one<{ maxSort: number | null }>(
    `SELECT MAX(sort_order) AS "maxSort" FROM entries WHERE shelf = $1`,
    [shelf],
  );
  return res?.maxSort ?? 0;
}

export async function updateEntryFields(
  input: {
    id: string;
    name?: string;
    note?: string;
    summary?: string;
    catalogueNo?: string;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [input.id];
  if (input.name !== undefined) sets.push(`name = $${params.push(input.name)}`);
  if (input.note !== undefined) sets.push(`note = $${params.push(input.note)}`);
  if (input.summary !== undefined) sets.push(`summary = $${params.push(input.summary)}`);
  if (input.catalogueNo !== undefined) sets.push(`catalogue_no = $${params.push(input.catalogueNo)}`);
  if (sets.length === 0) return;
  await query(`UPDATE entries SET ${sets.join(", ")} WHERE id = $1`, params);
}
