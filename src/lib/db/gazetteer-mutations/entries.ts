// ============================================================================
// Entry write helpers (create / shelf-order / soft-delete / restore / purge / edit)
// Split out of the former monolithic gazetteer-mutations.ts (T-ARCH-12). Product
// rule 1 (WikiWriteConfirmation token) and all SQL are unchanged; only file
// boundaries moved.
// ============================================================================

import { one, query, rows, withTransaction } from "../pool";
import { DEFAULT_UNIVERSE_ID } from "../scope";
import { type WikiWriteConfirmation } from "../../actions/confirmation";

/**
 * Persist an entry's shelf placement and sort order (the persisted shelf order
 * the spec demands: `shelf` + `sortOrder`). Called after a tile is dropped.
 */
export async function updateEntryShelfOrder(input: {
  entryId: string;
  shelf: string;
  sortOrder: number;
}): Promise<void> {
  await query(
    `UPDATE entries SET shelf = $2, sort_order = $3 WHERE id = $1`,
    [input.entryId, input.shelf, input.sortOrder],
  );
}

// ---- Entries (creation) ---------------------------------------------------

/**
 * WIKI WRITE (product rule 1). Create a new entry (Research "Yes, write it in").
 * Requires a confirmation token, so it is only callable from the confirmed
 * confirmCard path. Idempotent on id (re-confirming a card updates in place).
 */
export async function insertEntry(
  input: {
    id: string;
    kind: string;
    name: string;
    catalogueNo: string;
    note: string;
    summary: string;
    shelf: string;
    sortOrder: number;
    universeId?: string;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  // F7: universe_id is NOT NULL as of the S1b contract, so every new entry must
  // carry its universe (defaults to the active universe). ON CONFLICT leaves it
  // unchanged so re-confirming a card never moves an entry between universes.
  await query(
    `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order, universe_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       kind = EXCLUDED.kind,
       name = EXCLUDED.name,
       catalogue_no = EXCLUDED.catalogue_no,
       note = EXCLUDED.note,
       summary = EXCLUDED.summary,
       shelf = EXCLUDED.shelf,
       sort_order = EXCLUDED.sort_order`,
    [
      input.id,
      input.kind,
      input.name,
      input.catalogueNo,
      input.note,
      input.summary,
      input.shelf,
      input.sortOrder,
      input.universeId ?? DEFAULT_UNIVERSE_ID,
    ],
  );
}

/**
 * WIKI WRITE (product rule 1). Create a new entry AND link it into the active
 * world in ONE transaction (TCK-E06). Both writes share a single client/txn, so
 * a bad worldId (valid format but no such world) FK-throws on the world_entities
 * INSERT and rolls the entry INSERT back WITH it, never leaving a persisted-but-
 * invisible orphan (the E06 bug). Mirrors insertEntry's ON CONFLICT(id) DO UPDATE
 * so a client-authored id re-submit still upserts in place (idempotent), and the
 * link is ON CONFLICT(world_id,entity_id) DO NOTHING so re-linking is a no-op.
 * Requires a confirmation token.
 */
export async function insertEntryLinkedToWorld(
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
  },
  worldId: string,
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await withTransaction(async (client) => {
    // Entry INSERT first, then the world link, both before COMMIT. ON CONFLICT(id)
    // DO UPDATE keeps insertEntry's idempotency verbatim (re-confirm upserts).
    await client.query(
      `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order, universe_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         kind = EXCLUDED.kind,
         name = EXCLUDED.name,
         catalogue_no = EXCLUDED.catalogue_no,
         note = EXCLUDED.note,
         summary = EXCLUDED.summary,
         shelf = EXCLUDED.shelf,
         sort_order = EXCLUDED.sort_order`,
      [
        entry.id,
        entry.kind,
        entry.name,
        entry.catalogueNo,
        entry.note,
        entry.summary,
        entry.shelf,
        entry.sortOrder,
        entry.universeId ?? DEFAULT_UNIVERSE_ID,
      ],
    );
    // Link the new entry into the active world in the SAME txn. A nonexistent
    // worldId FK-throws here and rolls the entry INSERT back with it.
    await client.query(
      `INSERT INTO world_entities (world_id, entity_id)
       VALUES ($1, $2)
       ON CONFLICT (world_id, entity_id) DO NOTHING`,
      [worldId, entry.id],
    );
  });
}

/**
 * WIKI WRITE (product rule 1). Soft-delete a single entry: stamp deleted_at so
 * the row is hidden from every live read (getAllEntries/getEntry filter
 * `deleted_at IS NULL`) WITHOUT removing the row — the ON DELETE CASCADE on
 * facts/ties/appearances/open_questions therefore never fires and every
 * referencing row survives to be rendered as a dangling "removed" tombstone.
 * Idempotent: the `AND deleted_at IS NULL` guard makes re-deleting a no-op that
 * preserves the original deletion timestamp. Requires a confirmation token.
 */
export async function softDeleteEntry(
  input: { id: string; deletedAt: number },
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await query(
    `UPDATE entries SET deleted_at = $2 WHERE id = $1 AND deleted_at IS NULL`,
    [input.id, input.deletedAt],
  );
}

/**
 * WIKI WRITE (product rule 1). Restore a soft-deleted entry: clear deleted_at so
 * the row reappears in every live read. This RE-ENTERS content into the live
 * wiki, so it is a wiki write and requires a confirmation token.
 *
 * Idempotent guard `AND deleted_at IS NOT NULL`: restoring an already-live entry
 * is a no-op that touches zero rows. The `WHERE id = $1` restricts the write to
 * the single addressed entry — no other tombstoned row is disturbed. Facts/ties
 * were never removed (soft-delete leaves children in place), so they re-link the
 * moment the entry is live again; restore needs no extra work on them.
 *
 * Returns the number of rows restored (1 on success, 0 when the id was missing
 * or already live).
 */
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

/**
 * WIKI WRITE (product rule 1, DESTRUCTIVE). Hard-delete every entry that has been
 * soft-deleted since before `cutoffMs` (epoch millis). This is a permanent,
 * irreversible removal — the ON DELETE CASCADE on facts/ties/appearances/
 * open_questions fires, so the entry AND all its children are gone. Requires a
 * confirmation token.
 *
 * The `deleted_at IS NOT NULL` clause is a hard safety rail: a LIVE entry (null
 * deleted_at) can NEVER be purged, no matter the cutoff. `cutoffMs` is owned by
 * the action wrapper (now - RETENTION_MS), mirroring how the soft-delete wrapper
 * owns `deletedAt = Date.now()`. Single statement -> atomic, no transaction
 * needed. Returns the number of entries purged.
 */
export async function purgeDeletedBefore(
  input: { cutoffMs: number },
  _confirmation: WikiWriteConfirmation,
): Promise<number> {
  const res = await query(
    `DELETE FROM entries WHERE deleted_at IS NOT NULL AND deleted_at < $1`,
    [input.cutoffMs],
  );
  return res.rowCount ?? 0;
}

/**
 * Persist the full order of one shelf after a drag. `orderedIds` is the shelf's
 * entries top-to-bottom; each is set to `shelf` with sort_order = its index, so
 * the DB row order matches exactly what the UI shows. One statement per row keeps
 * it parameterized (no value interpolation). Small dataset (<= 15 entries total).
 */
export async function reorderShelf(input: {
  shelf: string;
  orderedIds: string[];
}): Promise<void> {
  for (let i = 0; i < input.orderedIds.length; i++) {
    await query(`UPDATE entries SET shelf = $2, sort_order = $3 WHERE id = $1`, [
      input.orderedIds[i],
      input.shelf,
      i,
    ]);
  }
}

// ---- Ties -----------------------------------------------------------------

/** Highest sort_order currently on a shelf, or 0 if the shelf is empty. */
export async function getMaxSortOrderForShelf(shelf: string): Promise<number> {
  const res = await rows<{ maxSort: number | null }>(
    `SELECT MAX(sort_order) AS "maxSort" FROM entries WHERE shelf = $1`,
    [shelf],
  );
  return res[0]?.maxSort ?? 0;
}

/**
 * WIKI WRITE (product rule 1). Patch a subset of an entry's scalar fields
 * (name/note/summary/catalogueNo). Only the provided fields are written.
 * No-op (returns without a query) if no updatable field was provided.
 */
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
