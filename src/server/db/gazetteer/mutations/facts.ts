import { one, query, rows } from "@/server/db/pool";
import { type FactRow } from "@/domain/types";
import { type WikiWriteConfirmation } from "@/domain/result";

export async function insertFact(
  input: {
    id: string;
    entryId: string;
    key: string;
    value: string;
    fresh: boolean;
    sortOrder: number;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<FactRow> {
  const res = await one<FactRow>(
    `INSERT INTO facts (id, entry_id, key, value, fresh, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       key = EXCLUDED.key,
       value = EXCLUDED.value,
       fresh = EXCLUDED.fresh,
       sort_order = EXCLUDED.sort_order
     RETURNING id,
               entry_id  AS "entryId",
               key,
               value,
               fresh,
               sort_order AS "sortOrder"`,
    [input.id, input.entryId, input.key, input.value, input.fresh, input.sortOrder],
  );
  if (!res) throw new Error("insertFact: no row returned");
  return res;
}

export async function updateFactEntry(input: {
  factId: string;
  toEntryId: string;
  sortOrder: number;
}): Promise<void> {
  await query(
    `UPDATE facts SET entry_id = $2, sort_order = $3 WHERE id = $1`,
    [input.factId, input.toEntryId, input.sortOrder],
  );
}

export async function deleteFact(
  factId: string,
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await query(`DELETE FROM facts WHERE id = $1`, [factId]);
}

export async function getMaxSortOrderForFacts(entryId: string): Promise<number> {
  const res = await rows<{ maxSort: number | null }>(
    `SELECT MAX(sort_order) AS "maxSort" FROM facts WHERE entry_id = $1`,
    [entryId],
  );
  return res[0]?.maxSort ?? 0;
}

export async function updateFact(
  input: { id: string; key?: string; value?: string },
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [input.id];
  if (input.key !== undefined) sets.push(`key = $${params.push(input.key)}`);
  if (input.value !== undefined) sets.push(`value = $${params.push(input.value)}`);
  if (sets.length === 0) return;
  await query(`UPDATE facts SET ${sets.join(", ")} WHERE id = $1`, params);
}

