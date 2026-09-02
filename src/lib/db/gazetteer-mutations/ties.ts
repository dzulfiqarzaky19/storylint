// ============================================================================
// Tie write helpers (+ create-entry-with-tie transaction)
// Split out of the former monolithic gazetteer-mutations.ts (T-ARCH-12). Product
// rule 1 (WikiWriteConfirmation token) and all SQL are unchanged; only file
// boundaries moved.
// ============================================================================

import { one, query, rows, withTransaction } from "../pool";
import { DEFAULT_UNIVERSE_ID } from "../scope";
import { type TieRow } from "../../domain/types";
import { type WikiWriteConfirmation } from "../../actions/confirmation";

/**
 * WIKI WRITE (product rule 1). Insert a directional tie. The prototype seeds
 * both directions; callers do so explicitly. Requires a confirmation token.
 */
export async function insertTie(
  input: {
    id: string;
    fromEntryId: string;
    toEntryId: string;
    rel: string;
    // F7 (S4): omitted => book_id NULL = canon tie (shows in every book);
    // a book id stamps it book-only. Existing callers pass no bookId, so their
    // ties stay canon exactly as before.
    bookId?: string;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<TieRow> {
  const res = await one<TieRow>(
    `INSERT INTO ties (id, from_entry_id, to_entry_id, rel, book_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id,
               from_entry_id AS "fromEntryId",
               to_entry_id   AS "toEntryId",
               rel`,
    [input.id, input.fromEntryId, input.toEntryId, input.rel, input.bookId ?? null],
  );
  if (!res) throw new Error("insertTie: no row returned");
  return res;
}

/**
 * WIKI WRITE (product rule 1). HARD-delete a single tie by id. Untie is an
 * INTENTIONAL removal of a relationship the writer drew, so it removes the row
 * outright — no `deleted_at` tombstone (unlike a soft-deleted entry, whose ties
 * survive to render as dangling "removed" badges). Requires a confirmation
 * token, mirroring insertTie (defence in depth on every wiki write).
 */
export async function deleteTie(
  tieId: string,
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await query(`DELETE FROM ties WHERE id = $1`, [tieId]);
}

/**
 * WIKI WRITE (product rule 1). Create a NEW entry AND a tie to it in ONE
 * transaction (the "add a new person as <rel>-to-X" primitive). Both writes
 * share a single client/txn, so they commit together or roll back together: if
 * the tie insert fails (e.g. its target entry does not exist, violating the
 * ties FK), the just-inserted person is rolled back with it and never orphaned.
 * Requires a confirmation token.
 */
export async function createEntryWithTie(
  input: {
    entry: {
      id: string;
      kind: string;
      name: string;
      catalogueNo: string;
      note: string;
      summary: string;
      shelf: string;
      sortOrder: number;
      universeId?: string;
    };
    tie: { id: string; fromEntryId: string; toEntryId: string; rel: string };
    /** TCK-E06: active world to link the new entry into, atomically in this txn. */
    worldId: string;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<TieRow> {
  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order, universe_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.entry.id,
        input.entry.kind,
        input.entry.name,
        input.entry.catalogueNo,
        input.entry.note,
        input.entry.summary,
        input.entry.shelf,
        input.entry.sortOrder,
        input.entry.universeId ?? DEFAULT_UNIVERSE_ID,
      ],
    );
    // TCK-E06: link the new entry into the active world in the SAME txn, so the
    // entry, its tie, and its world membership commit or roll back together 
    // never a persisted-but-invisible orphan. Idempotent (ON CONFLICT DO NOTHING).
    await client.query(
      `INSERT INTO world_entities (world_id, entity_id)
       VALUES ($1, $2)
       ON CONFLICT (world_id, entity_id) DO NOTHING`,
      [input.worldId, input.entry.id],
    );
    const res = await client.query<TieRow>(
      `INSERT INTO ties (id, from_entry_id, to_entry_id, rel)
       VALUES ($1, $2, $3, $4)
       RETURNING id,
                 from_entry_id AS "fromEntryId",
                 to_entry_id   AS "toEntryId",
                 rel`,
      [input.tie.id, input.tie.fromEntryId, input.tie.toEntryId, input.tie.rel],
    );
    const tie = res.rows[0];
    if (!tie) throw new Error("createEntryWithTie: no tie row returned");
    return tie;
  });
}
