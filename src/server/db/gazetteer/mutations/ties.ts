import { one, query, withTransaction } from "@/server/db/pool";
import { INSERT_ENTRY_IN_WORLD, entryParams, type NewEntry } from "./entries";
import { type TieRow } from "@/domain/types";
import { type WikiWriteConfirmation } from "@/domain/result";

const TIE_RETURNING = `
  RETURNING id,
            from_entry_id AS "fromEntryId",
            to_entry_id   AS "toEntryId",
            rel`;

export async function insertTie(
  input: { id: string; fromEntryId: string; toEntryId: string; rel: string },
  _confirmation: WikiWriteConfirmation,
): Promise<TieRow> {
  const res = await one<TieRow>(
    `INSERT INTO ties (id, from_entry_id, to_entry_id, rel)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       from_entry_id = EXCLUDED.from_entry_id,
       to_entry_id   = EXCLUDED.to_entry_id,
       rel           = EXCLUDED.rel
     ${TIE_RETURNING}`,
    [input.id, input.fromEntryId, input.toEntryId, input.rel],
  );
  if (!res) throw new Error("insertTie: no row returned");
  return res;
}

export async function deleteTie(
  tieId: string,
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await query(`DELETE FROM ties WHERE id = $1`, [tieId]);
}

export async function createEntryWithTie(
  input: {
    entry: NewEntry;
    tie: { id: string; fromEntryId: string; toEntryId: string; rel: string };
    worldId: string;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<TieRow> {
  return withTransaction(async (client) => {
    const inserted = await client.query(
      INSERT_ENTRY_IN_WORLD,
      entryParams(input.entry, input.worldId),
    );
    if ((inserted.rowCount ?? 0) === 0) {
      throw new Error(`createEntryWithTie: no world ${input.worldId}`);
    }
    await client.query(
      `INSERT INTO world_entries (world_id, entry_id) VALUES ($1, $2)`,
      [input.worldId, input.entry.id],
    );
    const res = await client.query<TieRow>(
      `INSERT INTO ties (id, from_entry_id, to_entry_id, rel)
       VALUES ($1, $2, $3, $4)
       ${TIE_RETURNING}`,
      [input.tie.id, input.tie.fromEntryId, input.tie.toEntryId, input.tie.rel],
    );
    const tie = res.rows[0];
    if (!tie) throw new Error("createEntryWithTie: no tie row returned");
    return tie;
  });
}
