// /wiki gazetteer WRITE layer. Entry/fact/tie/category/membership/facet/trash
// mutations. Structural universe/world/book SQL stays in mutations.ts.
import { query, one, rows, withTransaction } from "./pool";
import { DEFAULT_UNIVERSE_ID } from "./scope";
import type { FactRow, TieRow, CategoryRow, Shelf } from "../domain/types";
import { SHELF_TITLES } from "../domain/types";
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
    // F7 (S4) list divergence: omitted / undefined => book_id NULL = universe
    // canon (shows in every book), preserving the pre-S4 behavior of every
    // existing caller byte-for-byte. A book id stamps this fact as book-only.
    bookId?: string;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<FactRow> {
  const res = await one<FactRow>(
    // Idempotent on id (mirrors insertEntry): re-confirming a card with a stable
    // fact id (e.g. the enrich path's `prop-fact-<propId>`) updates the fact in
    // place instead of PK-violating or minting a duplicate. Random-uuid callers
    // (addSuggestionAsFact) never collide, so their behavior is unchanged.
    `INSERT INTO facts (id, entry_id, key, value, fresh, sort_order, book_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       key = EXCLUDED.key,
       value = EXCLUDED.value,
       fresh = EXCLUDED.fresh,
       sort_order = EXCLUDED.sort_order,
       book_id = EXCLUDED.book_id
     RETURNING id,
               entry_id  AS "entryId",
               key,
               value,
               fresh,
               sort_order AS "sortOrder"`,
    [input.id, input.entryId, input.key, input.value, input.fresh, input.sortOrder, input.bookId ?? null],
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
 * WIKI WRITE (product rule 1). HARD-delete a single fact by id. A fact is a
 * low-stakes wiki detail (no cascade), so it removes the row outright without a
 * tombstone. Requires a confirmation token, mirroring insertFact (defence in
 * depth on every wiki write).
 */
export async function deleteFact(
  factId: string,
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await query(`DELETE FROM facts WHERE id = $1`, [factId]);
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


/** Highest sort_order currently on a shelf, or 0 if the shelf is empty. */
export async function getMaxSortOrderForShelf(shelf: string): Promise<number> {
  const res = await rows<{ maxSort: number | null }>(
    `SELECT MAX(sort_order) AS "maxSort" FROM entries WHERE shelf = $1`,
    [shelf],
  );
  return res[0]?.maxSort ?? 0;
}

/**
 * Highest sort_order among an entry's facts, or 0 if it has none. Used by the
 * enrich path to append a new fact at the end of the target entry's fact list.
 */
export async function getMaxSortOrderForFacts(entryId: string): Promise<number> {
  const res = await rows<{ maxSort: number | null }>(
    `SELECT MAX(sort_order) AS "maxSort" FROM facts WHERE entry_id = $1`,
    [entryId],
  );
  return res[0]?.maxSort ?? 0;
}

// ---- Categories + category "delete" (F9-B; was F6-S5 category_labels) ------
//
// F9-B: categories are user-extensible data rows (the `categories` table) that
// REPLACED the fixed kind enum + `category_labels` override table. A category's
// `label` is the single source for the header text (reads no longer coalesce
// against a separate override table). Renaming/resetting a category touches only
// the categories row — no entry/fact/tie — so it is NOT a wiki-knowledge write
// (product rule 1) and needs no confirmation token. Creating a category likewise
// adds no wiki knowledge (an empty category), so it needs no token. "Delete
// category" is the one exception: it is a BULK soft-delete of every entry of that
// category, so it reuses the S2 softDeleteEntry gate and DEMANDS a
// WikiWriteConfirmation.

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

/**
 * WIKI WRITE (product rule 1). Patch a subset of a fact's fields (key/value).
 * Only the provided fields are written. No-op if neither was provided.
 */
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


// ---- World membership (TCK-023, W-4b: the "share" op) ---------------------
// world_entities is the M2M membership junction (PRIMARY KEY(world_id, entity_id)).
// An entry stays HOME to its universe_id; world membership is ADDITIVE — a link
// row makes the entity appear in that world's loadWorldSnapshot (which reads
// membership through `JOIN world_entities`). STRUCTURAL, not wiki CONTENT (it adds
// no fact/prose to the entry, only a grouping), so — like insertWorld — it needs
// NO WikiWriteConfirmation token.

/**
 * TCK-023 (W-4b): LINK an existing entity into a world (share it). Inserts one
 * membership row. IDEMPOTENT: ON CONFLICT (world_id, entity_id) DO NOTHING means a
 * double-link leaves EXACTLY ONE row (never a PK violation, never a duplicate).
 * The entity's HOME-world membership and every other link are untouched.
 */
export async function linkEntityToWorld(worldId: string, entityId: string): Promise<void> {
  await query(
    `INSERT INTO world_entities (world_id, entity_id)
     VALUES ($1, $2)
     ON CONFLICT (world_id, entity_id) DO NOTHING`,
    [worldId, entityId],
  );
}

/**
 * TCK-023 (W-4b) + orphan=DELETE-on-last-link: UNLINK an entity from a world (stop
 * sharing it there). Drops that membership row; if it was the entity's LAST world
 * link, the entity ROW (and its ON DELETE CASCADE children: facts/ties/facets/
 * appearances/open_questions/plotline edges) is deleted too — an entity with zero
 * world links is unreachable dead data, never a kept orphan. A link into any OTHER
 * world keeps the entity alive there. Both steps run in ONE transaction so a
 * concurrent re-link can't strand a half-deleted entity. Unlink of a NON-member is
 * a no-op (0 rows removed, entity untouched, no throw).
 */
export async function unlinkEntityFromWorld(worldId: string, entityId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `DELETE FROM world_entities WHERE world_id = $1 AND entity_id = $2`,
      [worldId, entityId],
    );
    // Last link gone -> the entity follows. NOT EXISTS is evaluated AFTER the
    // unlink above (same txn), so an entity still linked elsewhere is spared.
    await client.query(
      `DELETE FROM entries e
        WHERE e.id = $1
          AND NOT EXISTS (SELECT 1 FROM world_entities we WHERE we.entity_id = e.id)`,
      [entityId],
    );
  });
}

// ---- Entry facets (F7 S4 scalar override) ---------------------------------
// A facet is a per-book SCALAR override of an entry (name/summary/note). Unlike
// the structural universe/series/book inserts above, a facet IS wiki CONTENT
// (it changes what a reader sees for an entry), so per product rule 1 it REQUIRES
// a WikiWriteConfirmation token — same gate as insertFact/insertEntry.

export interface EntryFacetRow {
  entryId: string;
  bookId: string;
  name: string | null;
  summary: string | null;
  note: string | null;
}

/**
 * WIKI WRITE (product rule 1). Upsert a per-book scalar override for an entry.
 * PK(entry_id, book_id) => at most one facet row per entry per book, so a repeat
 * override on the same (entry, book) UPDATEs in place rather than duplicating.
 * A NULL column means "no override for that field in this book" — the book view
 * (COALESCE(facet.col, canon.col)) then falls through to universe canon for that
 * field. Passing only { name } leaves summary/note NULL (canon still shows).
 * Requires a confirmation token.
 */
export async function upsertEntryFacet(
  input: {
    entryId: string;
    bookId: string;
    name?: string | null;
    summary?: string | null;
    note?: string | null;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<EntryFacetRow> {
  const res = await one<EntryFacetRow>(
    `INSERT INTO entry_facets (entry_id, book_id, name, summary, note)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (entry_id, book_id) DO UPDATE SET
       name = EXCLUDED.name,
       summary = EXCLUDED.summary,
       note = EXCLUDED.note
     RETURNING entry_id AS "entryId",
               book_id  AS "bookId",
               name,
               summary,
               note`,
    [input.entryId, input.bookId, input.name ?? null, input.summary ?? null, input.note ?? null],
  );
  if (!res) throw new Error("upsertEntryFacet: no row returned");
  return res;
}
