// Parameterized write helpers (INSERT/UPDATE) for the mutation paths in
// src/lib/actions/*. Companion to the read-only queries.ts (owned by calf);
// kept in a separate file to avoid concurrent-edit collisions on the shared
// query layer. Same rules as queries.ts:
//
//   * ALWAYS use $1/$2/... placeholders. NEVER interpolate values into SQL.
//   * Column names are snake_case in the DB; result aliases map to camelCase.
//
// These are minimal, clearly-named helpers. They do not enforce product rules;
// the confirmation invariant (product rule 1) lives at the action layer.

import { query, one, rows } from "./pool";
import type { FactRow, TieRow, ResolvedMarkRow, KeptCardRow, PropositionRow } from "../domain/types";
import type { WikiWriteConfirmation } from "../actions/confirmation";

// Helpers marked "WIKI WRITE" below require a WikiWriteConfirmation token (product
// rule 1). The token parameter is intentionally unused at runtime — its presence
// in the signature makes a non-confirmed call a compile-time type error, so these
// helpers cannot be reached from any path that did not pass through the gate.

// ---- Facts ----------------------------------------------------------------

/**
 * WIKI WRITE (product rule 1). Insert a new fact on an entry. Requires a
 * WikiWriteConfirmation token, so it is only callable from a confirmed path
 * (addSuggestionAsFact / confirmCard). Returns the created row (camelCase).
 */
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
     RETURNING id,
               entry_id  AS "entryId",
               key,
               value,
               fresh,
               sort_order AS "sortOrder"`,
    [input.id, input.entryId, input.key, input.value, input.fresh, input.sortOrder],
  );
  // one() returns null only on empty result; INSERT ... RETURNING always yields a row.
  if (!res) throw new Error("insertFact: no row returned");
  return res;
}

/** Move a fact to a different entry (drag a fact tile between entries). */
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

/** Clear the "fresh" highlight on a fact once it has settled. */
export async function clearFactFresh(factId: string): Promise<void> {
  await query(`UPDATE facts SET fresh = FALSE WHERE id = $1`, [factId]);
}

// ---- Entries (shelf order) ------------------------------------------------

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
  },
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await query(
    `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
    ],
  );
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
  },
  _confirmation: WikiWriteConfirmation,
): Promise<TieRow> {
  const res = await one<TieRow>(
    `INSERT INTO ties (id, from_entry_id, to_entry_id, rel)
     VALUES ($1, $2, $3, $4)
     RETURNING id,
               from_entry_id AS "fromEntryId",
               to_entry_id   AS "toEntryId",
               rel`,
    [input.id, input.fromEntryId, input.toEntryId, input.rel],
  );
  if (!res) throw new Error("insertTie: no row returned");
  return res;
}

// ---- Chapters (manuscript) ------------------------------------------------

/** Save a chapter's ProseMirror JSON body. */
export async function saveChapterBody(input: {
  number: number;
  body: unknown;
}): Promise<void> {
  await query(
    `UPDATE chapters SET body = $2 WHERE number = $1`,
    [input.number, JSON.stringify(input.body)],
  );
}

// ---- Resolved marks (Write) -----------------------------------------------

/**
 * Persist a mark resolution by its stable markKey (§7). Idempotent upsert so a
 * dismissed mark never returns even after the paragraph moves.
 */
export async function upsertResolvedMark(input: {
  markKey: string;
  resolution: string;
  resolvedAt: number;
}): Promise<ResolvedMarkRow> {
  const res = await one<ResolvedMarkRow>(
    `INSERT INTO resolved_marks (mark_key, resolution, resolved_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (mark_key)
       DO UPDATE SET resolution = EXCLUDED.resolution, resolved_at = EXCLUDED.resolved_at
     RETURNING mark_key    AS "markKey",
               resolution,
               resolved_at AS "resolvedAt"`,
    [input.markKey, input.resolution, input.resolvedAt],
  );
  if (!res) throw new Error("upsertResolvedMark: no row returned");
  return res;
}

// ---- Kept cards (Research) ------------------------------------------------

/** Keep a proposition card on the Kept board (idempotent by propositionId). */
export async function upsertKeptCard(input: {
  propositionId: string;
  keptAt: number;
}): Promise<KeptCardRow> {
  const res = await one<KeptCardRow>(
    `INSERT INTO kept_cards (proposition_id, kept_at, in_wiki)
     VALUES ($1, $2, FALSE)
     ON CONFLICT (proposition_id) DO UPDATE SET kept_at = EXCLUDED.kept_at
     RETURNING proposition_id AS "propositionId",
               kept_at        AS "keptAt",
               in_wiki        AS "inWiki"`,
    [input.propositionId, input.keptAt],
  );
  if (!res) throw new Error("upsertKeptCard: no row returned");
  return res;
}

/**
 * Remove a proposition from the Kept board ("un-keep"). Idempotent.
 *
 * A card that has already been written into the wiki (`in_wiki = TRUE`) must NOT
 * be removable this way: its row is the sole record that the wiki entry came
 * from this card, and the wiki entry itself is not deleted here. Deleting the
 * row would leave an orphaned wiki entry while the board reverts the card to
 * "not kept / not in wiki" on reload — a permanent state/data desync. So the
 * DELETE is scoped to non-in-wiki rows. Returns true if a row was removed.
 */
export async function deleteKeptCard(propositionId: string): Promise<boolean> {
  const res = await query(
    `DELETE FROM kept_cards WHERE proposition_id = $1 AND in_wiki = FALSE`,
    [propositionId],
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * WIKI WRITE (product rule 1). Mark a kept card as written into the wiki (after
 * confirmCard). Requires a confirmation token.
 */
export async function markKeptInWiki(
  propositionId: string,
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await query(
    `UPDATE kept_cards SET in_wiki = TRUE WHERE proposition_id = $1`,
    [propositionId],
  );
}

// ---- Dismissed suggestions (Wiki poster "Leave it") -----------------------

/** Record a dismissed suggestion by its stable key (idempotent). */
export async function insertDismissedSuggestion(suggestionKey: string): Promise<void> {
  await query(
    `INSERT INTO dismissed_suggestions (suggestion_key)
     VALUES ($1)
     ON CONFLICT (suggestion_key) DO NOTHING`,
    [suggestionKey],
  );
}

// ---- Reads used by mutation paths -----------------------------------------
// These are SELECTs, but they live here (not queries.ts) because they exist
// solely to support the write paths above (e.g. confirmCard needs the source
// proposition and the next free sortOrder). Keeping them beside their callers
// avoids concurrent edits to the shared read layer.

/** Fetch a single proposition (source of a confirmed entry). */
export async function getProposition(id: string): Promise<PropositionRow | null> {
  return one<PropositionRow>(
    `SELECT id,
            turn_id  AS "turnId",
            kind,
            title,
            body,
            as_kind  AS "asKind",
            sort_order AS "sortOrder"
     FROM propositions WHERE id = $1`,
    [id],
  );
}

/** Highest sort_order currently on a shelf, or 0 if the shelf is empty. */
export async function getMaxSortOrderForShelf(shelf: string): Promise<number> {
  const res = await rows<{ maxSort: number | null }>(
    `SELECT MAX(sort_order) AS "maxSort" FROM entries WHERE shelf = $1`,
    [shelf],
  );
  return res[0]?.maxSort ?? 0;
}
