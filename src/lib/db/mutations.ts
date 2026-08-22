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

import { randomUUID } from "node:crypto";
import { query, one, rows, withTransaction } from "./pool";
import { DEFAULT_BOOK_ID, DEFAULT_WORLD_ID, DEFAULT_UNIVERSE_ID } from "./scope";
import type { FactRow, TieRow, ResolvedMarkRow, KeptCardRow, PropositionRow, CategoryRow, Shelf, ChapterCheckCacheRow } from "../domain/types";
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

// ---- Chapters (manuscript) ------------------------------------------------

/** Save a chapter's ProseMirror JSON body. */
export async function saveChapterBody(input: {
  number: number;
  body: unknown;
  bookId?: string;
}): Promise<void> {
  // F7 book scope: `number` is unique only within a book, so the UPDATE must
  // carry book_id or saving Chapter 1 could overwrite a sibling book's Chapter 1.
  await query(
    `UPDATE chapters SET body = $2 WHERE number = $1 AND book_id = $3`,
    [input.number, JSON.stringify(input.body), input.bookId ?? DEFAULT_BOOK_ID],
  );
}

/**
 * Refresh the book-wide phrase index for ONE chapter (Tier 2 cross-chapter
 * recurrence). Atomically deletes this chapter's existing rows and inserts the
 * freshly-extracted phrase counts, so the index always reflects the current
 * body (a phrase removed from the chapter disappears from the index). Ranking
 * data only; never gates a mark. `phrases` maps a (lowercased) phrase to its
 * occurrence count in this chapter; an empty map just clears the chapter's rows.
 */
export async function replacePhraseMentions(input: {
  chapterNumber: number;
  phrases: ReadonlyMap<string, number>;
}): Promise<void> {
  // Batch the whole refresh into two statements (one DELETE + one set-based
  // INSERT via UNNEST) so a chapter with N distinct phrases costs one round-trip
  // instead of N. The (phrase, chapter_number) pairs are unique by construction
  // — `phrases` is a Map, so each phrase appears once — but ON CONFLICT stays as
  // defence: it makes a same-chapter re-run idempotent and keeps a stray
  // duplicate from aborting the batch ("cannot affect row a second time"). Both
  // statements share one transaction so the index is never half-refreshed.
  const phrases = [...input.phrases.keys()];
  const counts = [...input.phrases.values()];
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM phrase_mentions WHERE chapter_number = $1`, [
      input.chapterNumber,
    ]);
    if (phrases.length === 0) return; // empty map just clears the chapter's rows
    await client.query(
      `INSERT INTO phrase_mentions (phrase, chapter_number, count)
       SELECT p, $2, c
         FROM UNNEST($1::text[], $3::int[]) AS t(p, c)
       ON CONFLICT (phrase, chapter_number)
         DO UPDATE SET count = EXCLUDED.count`,
      [phrases, input.chapterNumber, counts],
    );
  });
}

/** Next chapter number for a book (max+1 within that book, or 1 when empty). */
export async function getNextChapterNumber(
  bookId: string = DEFAULT_BOOK_ID,
): Promise<number> {
  // F7 book scope: numbering restarts per book, so MAX must be taken WITHIN the
  // book. A global MAX+1 would skip numbers in one book whenever another book
  // grew, and break the per-book UNIQUE(book_id, number) intent.
  const res = await one<{ next: number }>(
    `SELECT COALESCE(MAX(number), 0) + 1 AS next FROM chapters WHERE book_id = $1`,
    [bookId],
  );
  return res?.next ?? 1;
}

/** Insert a new chapter with an initial body. Returns its number. */
export async function insertChapter(input: {
  id: string;
  number: number;
  title: string;
  body: unknown;
  bookId?: string;
}): Promise<{ id: string; number: number; title: string }> {
  // F7: book_id is NOT NULL as of the S1b contract, so every new chapter must be
  // stamped with its book (defaults to the active book).
  const res = await one<{ id: string; number: number; title: string }>(
    `INSERT INTO chapters (id, number, title, body, book_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, number, title`,
    [input.id, input.number, input.title, JSON.stringify(input.body), input.bookId ?? DEFAULT_BOOK_ID],
  );
  return res!;
}

/** Rename a chapter (title only) within its book. */
export async function renameChapter(input: {
  number: number;
  title: string;
  bookId?: string;
}): Promise<void> {
  // Book scope: `number` is unique only within a book, so the UPDATE must carry
  // book_id or renaming Chapter 1 could rename a sibling book's Chapter 1.
  await query(
    `UPDATE chapters SET title = $2 WHERE number = $1 AND book_id = $3`,
    [input.number, input.title, input.bookId ?? DEFAULT_BOOK_ID],
  );
}

/** How many chapters a book has (guards the last-chapter-can't-delete rule). */
export async function countChaptersInBook(
  bookId: string = DEFAULT_BOOK_ID,
): Promise<number> {
  const res = await one<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM chapters WHERE book_id = $1`,
    [bookId],
  );
  return res?.n ?? 0;
}

/**
 * Delete one chapter from a book. Removes the chapter row (its
 * chapter_check_cache row cascades via ON DELETE CASCADE) and clears the
 * chapter's rows from the book-agnostic phrase_mentions rank index so a deleted
 * chapter's phrases stop inflating cross-chapter recurrence. Both run in one
 * transaction so the index is never left referencing a gone chapter. Returns the
 * number of chapter rows removed (0 when the number/book pair did not match).
 */
export async function deleteChapter(input: {
  number: number;
  bookId?: string;
}): Promise<{ deleted: number }> {
  const bookId = input.bookId ?? DEFAULT_BOOK_ID;
  return withTransaction(async (client) => {
    await client.query(
      `DELETE FROM phrase_mentions WHERE chapter_number = $1`,
      [input.number],
    );
    const res = await client.query(
      `DELETE FROM chapters WHERE number = $1 AND book_id = $2`,
      [input.number, bookId],
    );
    return { deleted: res.rowCount ?? 0 };
  });
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
 * Rename a WORLD in place. UPDATEs worlds.title. TRIMS the input and treats an
 * empty/whitespace-only title as a no-op (never writes a blank, which would
 * render a nameless world in the switcher and manage screen). Structural — no
 * wiki token (touches no entry/fact/tie), mirroring renameCategory.
 */
export async function renameWorld(input: {
  id: string;
  title: string;
}): Promise<void> {
  const title = input.title.trim();
  if (title === "") return; // blank rename is a no-op, not a blanked world name
  await query(
    `UPDATE worlds SET title = $2 WHERE id = $1`,
    [input.id, title],
  );
}

/**
 * Rename a UNIVERSE in place. UPDATEs universes.name. Same trim + blank-is-no-op
 * contract as renameWorld/renameCategory. Structural — no wiki token.
 */
export async function renameUniverse(input: {
  id: string;
  name: string;
}): Promise<void> {
  const name = input.name.trim();
  if (name === "") return; // blank rename is a no-op, not a blanked universe name
  await query(
    `UPDATE universes SET name = $2 WHERE id = $1`,
    [input.id, name],
  );
}

/**
 * T-SCOPE-2: rename a BOOK in place (the /write book dropdown Rename affordance).
 * UPDATEs books.name. Same trim + blank-is-no-op contract as
 * renameWorld/renameUniverse, so a whitespace-only rename never blanks the
 * book's name. Structural — no wiki token (renames no wiki CONTENT).
 */
export async function renameBook(input: {
  id: string;
  name: string;
}): Promise<void> {
  const name = input.name.trim();
  if (name === "") return; // blank rename is a no-op, not a blanked book name
  await query(
    `UPDATE books SET name = $2 WHERE id = $1`,
    [input.id, name],
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

// ---- Research threads (Track B — multi-thread sidebar) --------------------
// APPEND-ONLY: writes for "New thread". Creating a thread is NOT a wiki write
// (product rule 1), so it needs no confirmation token — it only adds an empty
// conversation column, never an entry. No existing helper above is modified.

/** Next free sort_order for a new research thread (max + 1, or 0 if none). */
export async function getNextResearchThreadSortOrder(
  worldId?: string,
): Promise<number> {
  // T-RESEARCH-2: order a new thread relative to its OWN world's threads when a
  // world is given (so each world's rail numbers from 0), else the global max.
  const res = worldId
    ? await rows<{ maxSort: number | null }>(
        `SELECT MAX(sort_order) AS "maxSort" FROM research_threads WHERE world_id = $1`,
        [worldId],
      )
    : await rows<{ maxSort: number | null }>(
        `SELECT MAX(sort_order) AS "maxSort" FROM research_threads`,
      );
  return (res[0]?.maxSort ?? -1) + 1;
}

/**
 * Insert a new research thread row (the "New thread" action). Parameterized;
 * subtitle defaults to '' at the DB layer but we pass it explicitly. Returns
 * the created row (camelCase) so the caller can navigate to it.
 */
export async function insertResearchThread(input: {
  id: string;
  title: string;
  subtitle: string;
  sortOrder: number;
  scope: import("../domain/types").ResearchScope;
  universeId?: string;
  worldId?: string;
}): Promise<import("../domain/types").ResearchThreadRow> {
  // F7: universe_id is NOT NULL (S1b contract). T-RESEARCH-2: world_id is NOT
  // NULL too — a thread is grounded in ONE world. Default to the active
  // universe's DEFAULT world only when the caller omits worldId (legacy callers);
  // the research action always passes the active world so a new thread lands in
  // the world the writer is viewing (never silently in the default world).
  const universeId = input.universeId ?? DEFAULT_UNIVERSE_ID;
  const worldId = input.worldId ?? `world-${universeId}`;
  const res = await one<import("../domain/types").ResearchThreadRow>(
    `INSERT INTO research_threads (id, title, subtitle, sort_order, scope, universe_id, world_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, title, subtitle, sort_order AS "sortOrder", scope, world_id AS "worldId"`,
    [input.id, input.title, input.subtitle, input.sortOrder, input.scope, universeId, worldId],
  );
  if (!res) throw new Error("insertResearchThread: no row returned");
  return res;
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

// ---- Research turns (F2a — persist an AI ask atomically) ------------------
// askResearchAi becomes a WRITING action: the writer's question ("you") and the
// AI reply ("them") plus the reply's proposition cards persist ALL-OR-NOTHING in
// ONE transaction. A them-turn with no you-turn (or orphan cards) is worse than
// no write, so any failure rolls the whole pair back. Not a wiki write (product
// rule 1) — these are conversation turns, not entries — so no confirmation token.

/** One proposition card to persist under the AI ("them") turn. */
export interface ResearchCardInput {
  id: string;
  kind: string;
  title: string;
  body: string;
  asKind: string;
}

/** The you-turn + them-turn (+cards) to persist for one AI ask. */
export interface ResearchTurnPairInput {
  threadId: string;
  youId: string;
  themId: string;
  who: { you: string; them: string };
  question: string;
  reply: string;
  cards: ResearchCardInput[];
  /**
   * When set, auto-title the thread IN THE SAME TXN: if the thread's current
   * title is empty or the "New thread" placeholder, update it to this value.
   * A non-placeholder title is left untouched (the writer's first question
   * names the thread once, not on every ask).
   */
  autoTitle?: string;
}

/** A persisted turn's identity + assigned ordinal, returned for the reducer. */
export interface PersistedTurnRef {
  id: string;
  ordinal: number;
}

/**
 * Persist a question/answer pair (+cards) for one thread in a SINGLE transaction.
 *
 * ORDINAL-IN-TXN (the hard correctness condition): the next ordinal is computed
 * as MAX(ordinal)+1 for this thread INSIDE the same transaction as the inserts,
 * so two concurrent asks can never read the same MAX and collide — the you-turn
 * takes MAX+1 and the them-turn MAX+2 under one lock. Date.now() ordinals are
 * wrong (collide in the same millisecond, non-deterministic ordering).
 *
 * ATOMICITY: you-turn, them-turn, and every card insert run on one client; any
 * failure rolls back the whole pair (the caller then persists nothing and the
 * in-memory reducer never appends a half-pair).
 *
 * Rejects an empty threadId so a turn can never be written with thread_id = ''
 * (the bug this feature fixes). Returns the two turns' ids + assigned ordinals.
 */
export async function insertResearchTurnPair(
  input: ResearchTurnPairInput,
): Promise<{ you: PersistedTurnRef; them: PersistedTurnRef }> {
  if (!input.threadId) {
    throw new Error("insertResearchTurnPair: threadId is required (refusing to write an orphan turn)");
  }
  return withTransaction(async (client) => {
    const maxRes = await client.query<{ maxOrdinal: number | null }>(
      `SELECT MAX(ordinal) AS "maxOrdinal" FROM research_turns WHERE thread_id = $1`,
      [input.threadId],
    );
    const base = (maxRes.rows[0]?.maxOrdinal ?? -1) + 1;
    const youOrdinal = base;
    const themOrdinal = base + 1;

    await client.query(
      `INSERT INTO research_turns (id, thread_id, ordinal, side, who, text)
       VALUES ($1, $2, $3, 'you', $4, $5)`,
      [input.youId, input.threadId, youOrdinal, input.who.you, input.question],
    );
    await client.query(
      `INSERT INTO research_turns (id, thread_id, ordinal, side, who, text)
       VALUES ($1, $2, $3, 'them', $4, $5)`,
      [input.themId, input.threadId, themOrdinal, input.who.them, input.reply],
    );

    for (let i = 0; i < input.cards.length; i++) {
      const c = input.cards[i]!;
      await client.query(
        `INSERT INTO propositions (id, turn_id, kind, title, body, as_kind, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [c.id, input.themId, c.kind, c.title, c.body, c.asKind, i],
      );
    }

    // Auto-title in the SAME txn: name the thread from the first question only
    // while it still carries the empty/"New thread" placeholder, so title and
    // turns commit together (or roll back together).
    if (input.autoTitle !== undefined) {
      await client.query(
        `UPDATE research_threads
            SET title = $2
          WHERE id = $1 AND (title = '' OR title = 'New thread')`,
        [input.threadId, input.autoTitle],
      );
    }

    return {
      you: { id: input.youId, ordinal: youOrdinal },
      them: { id: input.themId, ordinal: themOrdinal },
    };
  });
}

/**
 * Hard-delete a research thread and everything under it, in ONE transaction.
 *
 * research_turns.thread_id is BARE TEXT with NO foreign key (schema.sql), so a
 * DELETE on research_threads does NOT cascade to its turns — the turns would be
 * orphaned. We therefore delete the turns FIRST (which DOES cascade to their
 * propositions, and propositions cascade to kept_cards), then the thread row.
 * Both statements share one transaction so a thread is never left half-deleted.
 */
export async function deleteThread(threadId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM research_turns WHERE thread_id = $1`, [threadId]);
    await client.query(`DELETE FROM research_threads WHERE id = $1`, [threadId]);
  });
}

/**
 * R3 last-thread floor: delete a thread ONLY if it is not the last one in its
 * world, so a live world's /research rail never drops to zero (the UI's
 * removeThread re-opens a fresh thread on the client, but a raw action call had
 * no such guard - this closes that hole server-side).
 *
 * Race-safe by construction: the count and the delete share ONE transaction, and
 * the count locks the world's thread rows with FOR UPDATE, so two concurrent
 * deletes cannot both observe count > 1 and drive the world to zero. A thread with
 * NULL world_id has no world floor to protect and is always deletable. Returns
 * false (deleted nothing) when the thread is its world's last one, so the caller
 * can surface a "can't delete the last thread" error instead of a silent no-op.
 */
export async function deleteLastThreadGuarded(threadId: string): Promise<boolean> {
  return withTransaction(async (client) => {
    const owner = await client.query<{ world_id: string | null }>(
      `SELECT world_id FROM research_threads WHERE id = $1`,
      [threadId],
    );
    const worldId = owner.rows[0]?.world_id ?? null;
    if (worldId !== null) {
      const siblings = await client.query(
        `SELECT id FROM research_threads WHERE world_id = $1 FOR UPDATE`,
        [worldId],
      );
      if (siblings.rowCount !== null && siblings.rowCount <= 1) return false;
    }
    await client.query(`DELETE FROM research_turns WHERE thread_id = $1`, [threadId]);
    await client.query(`DELETE FROM research_threads WHERE id = $1`, [threadId]);
    return true;
  });
}

/** Update a research thread's title (F2a auto-title). Parameterized. */
export async function updateThreadTitle(input: {
  threadId: string;
  title: string;
}): Promise<void> {
  await query(`UPDATE research_threads SET title = $2 WHERE id = $1`, [
    input.threadId,
    input.title,
  ]);
}

// ---- F7 worlds hierarchy: structural creation (Universe/World/Book) ---------
//
// These INSERT the STRUCTURAL rows of the worlds hierarchy. They are NOT wiki
// content, so per product rule 1 they take NO WikiWriteConfirmation token (same
// as createChapter).
//
// CONTINUATION vs FRESH is pure ROUTING, not a canon copy — ratified by chick
// (data-model gate) on schema evidence:
//   * CONTINUATION = a new World/Book under an EXISTING universe. The new book
//     reuses that universe's canon BY CONSTRUCTION: canon entries carry the
//     universe_id (loadWikiSnapshot filters on it) and canon facts/ties carry
//     book_id = NULL, so they surface in every book of the universe. NO row is
//     copied — a physical copy would DOUBLE canon (two `entries` rows for one
//     character) and break the single-source assumption the merge relies on.
//   * FRESH = a NEW universe (+ its first world and book). Its wiki is empty by
//     construction because no entries carry the new universe_id yet.
// So the fresh/continuation flag is simply WHICH universe_id the new structural
// rows get: an existing one (continuation) or a newly-minted one (fresh).

export interface UniverseRow {
  id: string;
  name: string;
}
export interface BookRow {
  id: string;
  worldId: string;
  name: string;
  sortOrder: number;
}

/** Insert a universe row (the canon root). Structural — no wiki token. */
export async function insertUniverse(input: {
  id: string;
  name: string;
}): Promise<UniverseRow> {
  const res = await one<UniverseRow>(
    `INSERT INTO universes (id, name) VALUES ($1, $2) RETURNING id, name`,
    [input.id, input.name],
  );
  if (!res) throw new Error("insertUniverse: no row returned");
  return res;
}

/**
 * Insert a book under a WORLD (CONTINUATION routing: default = the default world).
 * A new book starts EMPTY, so getNextChapterNumber(newBook) = 1 by construction
 * (COALESCE(MAX(number),0)+1 over zero chapters). W-6: `worldId` replaces the old
 * `seriesId`; the default is DEFAULT_WORLD_ID (a mis-set default silently mis-homes
 * every continuation book, so it is mutation-proven — gate mutation (d)).
 */
export async function insertBook(input: {
  id: string;
  name: string;
  worldId?: string;
  sortOrder?: number;
}): Promise<BookRow> {
  const res = await one<BookRow>(
    `INSERT INTO books (id, world_id, name, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, world_id AS "worldId", name, sort_order AS "sortOrder"`,
    [input.id, input.worldId ?? DEFAULT_WORLD_ID, input.name, input.sortOrder ?? 0],
  );
  if (!res) throw new Error("insertBook: no row returned");
  return res;
}

/**
 * Insert a book AND its first chapter ("Chapter One") in ONE transaction, so a
 * user-created book always lands with a home chapter ready to write in (never an
 * empty shell the /write page has to fake with EMPTY_BODY). This is the book-CRUD
 * create path (BookPill "+ New book"); the structural fresh-universe/new-world
 * paths still start empty by design (they mint their book as scaffolding, not as
 * a writing target). Atomic: a failure on the chapter rolls back the book, so
 * there is never a bookless-chapter or a chapterless user book. The caller mints
 * both ids so this stays a pure parameterized write.
 */
export async function insertBookWithFirstChapter(input: {
  id: string;
  name: string;
  worldId?: string;
  sortOrder?: number;
  firstChapterId: string;
  firstChapterTitle: string;
  firstChapterBody: unknown;
}): Promise<BookRow> {
  const worldId = input.worldId ?? DEFAULT_WORLD_ID;
  return withTransaction(async (client) => {
    // A new book APPENDS to the world's shelf (MAX(sort_order)+1), never ties at
    // 0. A 0-tie let getWorldTree's (sort_order, id) break by id, so a UUID book
    // (id < "book-1") displaced the seeded first book as books[0] — the no-param
    // /write default silently jumped to the new empty book. Appending keeps the
    // authored first book the stable default. An explicit sortOrder still wins.
    const nextSort =
      input.sortOrder ??
      (
        await client.query<{ next: number }>(
          `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM books WHERE world_id = $1`,
          [worldId],
        )
      ).rows[0]!.next;
    const res = await client.query<BookRow>(
      `INSERT INTO books (id, world_id, name, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, world_id AS "worldId", name, sort_order AS "sortOrder"`,
      [input.id, worldId, input.name, nextSort],
    );
    await client.query(
      `INSERT INTO chapters (id, number, title, body, book_id)
       VALUES ($1, 1, $2, $3, $4)`,
      [input.firstChapterId, input.firstChapterTitle, JSON.stringify(input.firstChapterBody), input.id],
    );
    if (!res.rows[0]) throw new Error("insertBookWithFirstChapter: no book row returned");
    return res.rows[0];
  });
}

/**
 * FRESH world: create a NEW universe plus its first world and first book, in ONE
 * transaction so a universe never lands without a home for chapters. The new
 * universe's wiki is empty by construction (no entries carry its universe_id).
 * W-6: mints universe + world + book (series is gone), plus the world's ONE
 * default research thread (R2: a world is born with a thread). This is the "fresh"
 * branch; continuation instead calls insertWorld/insertBook against an existing universe.
 */
export async function createFreshUniverse(input: {
  universeId: string;
  worldId: string;
  bookId: string;
  universeName: string;
  worldName?: string;
  bookName?: string;
}): Promise<{ universe: UniverseRow; world: WorldRow; book: BookRow }> {
  return withTransaction(async (client) => {
    const uni = await client.query<UniverseRow>(
      `INSERT INTO universes (id, name) VALUES ($1, $2) RETURNING id, name`,
      [input.universeId, input.universeName],
    );
    const world = await client.query<WorldRow>(
      `INSERT INTO worlds (id, universe_id, title, sort_order)
       VALUES ($1, $2, $3, 0)
       RETURNING id, universe_id AS "universeId", title, sort_order AS "sortOrder"`,
      [input.worldId, input.universeId, input.worldName ?? input.universeName],
    );
    const bk = await client.query<BookRow>(
      `INSERT INTO books (id, world_id, name, sort_order)
       VALUES ($1, $2, $3, 0)
       RETURNING id, world_id AS "worldId", name, sort_order AS "sortOrder"`,
      [input.bookId, input.worldId, input.bookName ?? input.worldName ?? input.universeName],
    );
    // R2: every world is born with exactly ONE default research thread so /research
    // never renders an empty rail (and R3's last-thread-delete guard always has a
    // floor of one). Same 7-col shape as insertResearchThread, scoped to the new
    // world (thread.world_id FKs worlds.id, so this runs AFTER the world INSERT).
    await client.query(
      `INSERT INTO research_threads (id, title, subtitle, sort_order, scope, universe_id, world_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), "New thread", "", 0, "chat", input.universeId, input.worldId],
    );
    // INSERT ... RETURNING always yields exactly one row.
    return { universe: uni.rows[0]!, world: world.rows[0]!, book: bk.rows[0]! };
  });
}

export interface WorldRow {
  id: string;
  universeId: string;
  title: string;
  sortOrder: number;
}

/**
 * TCK-022 (W-4a): create a SECOND (or Nth) world inside an EXISTING universe.
 * Today worlds are 1:1 per universe (the W-1 backfill `world-${universeId}`);
 * this is the first path that makes a second one, so the share/switch UI has two
 * worlds to move between.
 *
 * A world needs a home for chapters. W-6: `books` now FK `world_id` directly, so a
 * new world mints its OWN first book straight under itself (no bridge series). R2:
 * it is also born with ONE default research thread. All three rows land atomically:
 * a failure on any rolls back the others (no orphan world without a book/thread).
 *
 * Structural — no wiki content, so no confirmWikiWrite token. The new world's
 * wiki is empty by construction (no world_entities rows point at it).
 */
export async function insertWorld(input: {
  id: string;
  universeId: string;
  title: string;
  bookId: string;
  sortOrder?: number;
  bookName?: string;
}): Promise<WorldRow> {
  return withTransaction(async (client) => {
    // TCK-E08: default the sort_order to a MONOTONIC next value within the universe
    // (COALESCE(MAX+1, 0)) so a newly-minted world lands AFTER the universe's
    // existing worlds instead of colliding at 0 with the seed world. The collision
    // made getWorldTree's `ORDER BY sort_order, id` tiebreak on the random UUID, so
    // resolveWikiScope's default (worlds[0]) could pick a stray new world over the
    // seed and bare /wiki rendered the wrong world. Computed INSIDE this
    // transaction (not the action layer) so the MAX read + INSERT are atomic and
    // race-safe. An EXPLICIT sortOrder (tests, callers that order deliberately)
    // still wins - this only fills the omitted default.
    const sortOrder =
      input.sortOrder ??
      (
        await client.query<{ next: number }>(
          `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM worlds WHERE universe_id = $1`,
          [input.universeId],
        )
      ).rows[0]!.next;
    const world = await client.query<WorldRow>(
      `INSERT INTO worlds (id, universe_id, title, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, universe_id AS "universeId", title, sort_order AS "sortOrder"`,
      [input.id, input.universeId, input.title, sortOrder],
    );
    await client.query(
      `INSERT INTO books (id, world_id, name, sort_order)
       VALUES ($1, $2, $3, 0)`,
      [input.bookId, input.id, input.bookName ?? input.title],
    );
    // R2: mint the world's ONE default research thread (see createFreshUniverse).
    // Scoped to input.id (this world) — AFTER the world INSERT to satisfy the FK.
    await client.query(
      `INSERT INTO research_threads (id, title, subtitle, sort_order, scope, universe_id, world_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), "New thread", "", 0, "chat", input.universeId, input.id],
    );
    // INSERT ... RETURNING always yields exactly one row.
    return world.rows[0]!;
  });
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
 * TCK-023 (W-4b): UNLINK an entity from a world (stop sharing it there). Drops
 * ONLY that one membership row; the entity ROW is NEVER deleted (orphan = LEAVE,
 * mirroring deleteWorldCascade's rule that unlinking never destroys the entity)
 * and every OTHER world link — including its home membership — survives. Unlink of
 * a NON-member is a no-op (0 rows, no throw).
 */
export async function unlinkEntityFromWorld(worldId: string, entityId: string): Promise<void> {
  await query(
    `DELETE FROM world_entities WHERE world_id = $1 AND entity_id = $2`,
    [worldId, entityId],
  );
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

// ---- World delete-cascade (F7 S5) -----------------------------------------
// Deleting a universe / series / book destroys its whole subtree. STRUCTURAL, so
// no wiki-write token (product rule 1 gates wiki CONTENT — entries/facts/facets —
// not the world skeleton). The delete is HIGH-RISK, so it is built to be
// self-proving: every child row is deleted by an EXPLICIT statement (never left
// to ON DELETE CASCADE), and the reported count is the SUM of those statements'
// rowCounts. Because the count and the removal are the SAME statements in the
// SAME transaction, `count === rows-actually-removed` holds BY CONSTRUCTION — no
// separate SELECT COUNT that a concurrent write could make drift.
//
// Two invariants the ordering enforces (do NOT reorder the book-scoped deletes
// ahead of the entry-scoped ones):
//   * CANON survives book deletes. facts/ties with book_id IS NULL are universe
//     canon (shown in every book); a book/series/universe delete removes only
//     book_id-scoped rows for the target's books, never NULL-canon rows.
//   * CROSS-UNIVERSE trap. A book in the target can hold a book-scoped facet
//     (fact/tie/entry_facet) on an entry that belongs to ANOTHER universe. That
//     facet row must die with the book (book_id-scoped), but the FOREIGN entry
//     must survive. So facet rows are deleted by book_id; entries only by
//     universe_id. Running the book-scoped deletes FIRST also means a row that is
//     both book-scoped and on a target entry is deleted (and counted) exactly
//     once.

/** Per-table breakdown of a cascade delete, plus the summed total. */
export interface CascadeCount {
  ties: number;
  facts: number;
  entryFacets: number;
  chapterAppearances: number;
  chapters: number;
  openQuestions: number;
  entries: number;
  researchThreads: number;
  books: number;
  universes: number;
  // W-2: world-scoped counts. worldEntities = junction membership UNLINKED (the
  // entity ROW survives, reclaimable); categories = user categories owned by the
  // world (built-ins have world_id NULL, never counted here); worlds = the row.
  worldEntities: number;
  categories: number;
  worlds: number;
  total: number;
}

function emptyCascade(): CascadeCount {
  return {
    ties: 0,
    facts: 0,
    entryFacets: 0,
    chapterAppearances: 0,
    chapters: 0,
    openQuestions: 0,
    entries: 0,
    researchThreads: 0,
    books: 0,
    universes: 0,
    worldEntities: 0,
    categories: 0,
    worlds: 0,
    total: 0,
  };
}

/**
 * Delete a universe and its ENTIRE subtree (worlds, books, chapters, entries,
 * canon + book-scoped facts/ties/facets, appearances, open questions, research
 * threads). Returns the per-table cascade count whose `total` is exactly the
 * number of rows removed. One transaction: either the whole subtree goes or
 * nothing does. W-6: books now hang off worlds, so the book set joins books ->
 * worlds (was books -> series).
 */
export async function deleteUniverseCascade(universeId: string): Promise<CascadeCount> {
  return withTransaction(async (client) => {
    const c = emptyCascade();
    // Book set of this universe (its worlds' books). Entry set of this universe.
    const booksOfUniverse = `SELECT b.id FROM books b
        JOIN worlds w ON w.id = b.world_id
        WHERE w.universe_id = $1`;
    const entriesOfUniverse = `SELECT id FROM entries WHERE universe_id = $1`;

    // STEP 1 — book-scoped facet rows for this universe's books (may sit on a
    // FOREIGN-universe canon entry; scoped by book_id so the entry is untouched).
    c.ties += (await client.query(
      `DELETE FROM ties WHERE book_id IN (${booksOfUniverse})`, [universeId],
    )).rowCount ?? 0;
    c.facts += (await client.query(
      `DELETE FROM facts WHERE book_id IN (${booksOfUniverse})`, [universeId],
    )).rowCount ?? 0;
    c.entryFacets += (await client.query(
      `DELETE FROM entry_facets WHERE book_id IN (${booksOfUniverse})`, [universeId],
    )).rowCount ?? 0;

    // STEP 2 — canon children of this universe's entries (book_id IS NULL rows,
    // plus any not already removed in step 1). Entry-scoped.
    c.ties += (await client.query(
      `DELETE FROM ties
        WHERE from_entry_id IN (${entriesOfUniverse})
           OR to_entry_id IN (${entriesOfUniverse})`, [universeId],
    )).rowCount ?? 0;
    c.facts += (await client.query(
      `DELETE FROM facts WHERE entry_id IN (${entriesOfUniverse})`, [universeId],
    )).rowCount ?? 0;
    c.entryFacets += (await client.query(
      `DELETE FROM entry_facets WHERE entry_id IN (${entriesOfUniverse})`, [universeId],
    )).rowCount ?? 0;
    c.openQuestions += (await client.query(
      `DELETE FROM open_questions WHERE entry_id IN (${entriesOfUniverse})`, [universeId],
    )).rowCount ?? 0;

    // STEP 3 — remaining book-owned rows (appearances/chapters), book-scoped.
    c.chapterAppearances += (await client.query(
      `DELETE FROM chapter_appearances WHERE book_id IN (${booksOfUniverse})`, [universeId],
    )).rowCount ?? 0;
    c.chapters += (await client.query(
      `DELETE FROM chapters WHERE book_id IN (${booksOfUniverse})`, [universeId],
    )).rowCount ?? 0;

    // STEP 4 — entries (now childless; residual CASCADE fires on nothing).
    c.entries += (await client.query(
      `DELETE FROM entries WHERE universe_id = $1`, [universeId],
    )).rowCount ?? 0;

    // STEP 5 — research threads of this universe.
    c.researchThreads += (await client.query(
      `DELETE FROM research_threads WHERE universe_id = $1`, [universeId],
    )).rowCount ?? 0;

    // STEP 6 — the skeleton, leaf->root. W-6: books now hang off worlds (series is
    // gone), so the book delete keys off world_id. Worlds themselves are left intact
    // here, exactly as before this slice (a universe delete never dropped worlds).
    c.books += (await client.query(
      `DELETE FROM books WHERE world_id IN (SELECT id FROM worlds WHERE universe_id = $1)`,
      [universeId],
    )).rowCount ?? 0;
    c.universes += (await client.query(
      `DELETE FROM universes WHERE id = $1`, [universeId],
    )).rowCount ?? 0;

    c.total = c.ties + c.facts + c.entryFacets + c.chapterAppearances + c.chapters
      + c.openQuestions + c.entries + c.researchThreads + c.books + c.universes;
    return c;
  });
}

/**
 * Delete a single book and its book-scoped content (chapters, appearances, and
 * book-scoped facts/ties/facets book_id = target). NEVER touches NULL-canon rows
 * (they belong to the universe and stay visible in sibling books), never touches
 * a sibling book under the same world, never touches entries.
 */
export async function deleteBookCascade(bookId: string): Promise<CascadeCount> {
  return withTransaction(async (client) => {
    const c = emptyCascade();

    c.ties += (await client.query(
      `DELETE FROM ties WHERE book_id = $1`, [bookId],
    )).rowCount ?? 0;
    c.facts += (await client.query(
      `DELETE FROM facts WHERE book_id = $1`, [bookId],
    )).rowCount ?? 0;
    c.entryFacets += (await client.query(
      `DELETE FROM entry_facets WHERE book_id = $1`, [bookId],
    )).rowCount ?? 0;
    c.chapterAppearances += (await client.query(
      `DELETE FROM chapter_appearances WHERE book_id = $1`, [bookId],
    )).rowCount ?? 0;
    c.chapters += (await client.query(
      `DELETE FROM chapters WHERE book_id = $1`, [bookId],
    )).rowCount ?? 0;
    c.books += (await client.query(
      `DELETE FROM books WHERE id = $1`, [bookId],
    )).rowCount ?? 0;

    c.total = c.ties + c.facts + c.entryFacets + c.chapterAppearances + c.chapters + c.books;
    return c;
  });
}

/**
 * W-2/W-6 - Delete a WORLD and its world-owned data, WITHOUT destroying entities
 * or universe-canon. A world groups SHARED entities via the world_entities junction
 * and owns user categories (categories.world_id). W-6: a world now ALSO OWNS its
 * books directly (books.world_id), so deleting a world drops that book subtree
 * (chapters, appearances, book-scoped facts/ties/facets, then the books) too. This
 * is why the 2 leaked books used to survive a world delete pre-W-6 — books hung off
 * series, not the world; now they cascade.
 *
 * THE INVARIANT (orphan=LEAVE): the entity ROWS survive, reclaimable. We DELETE
 * the junction membership only (unlink), never the entries. Deleting the world
 * also drops its user categories; the 4 built-ins (world_id IS NULL) are GLOBAL
 * and SURVIVE so a shared entity kind still resolves in any world.
 *
 * Explicit COUNTED deletes in one transaction (never an implicit FK cascade, so
 * total is exact and count === rows-removed holds by construction), leaf->root:
 * book subtree -> junction -> user categories -> the world row.
 */
export async function deleteWorldCascade(worldId: string): Promise<CascadeCount> {
  return withTransaction(async (client) => {
    const c = emptyCascade();

    // W-6: the world's own books' subtree (book-scoped rows), leaf->root, BEFORE
    // the books themselves. Entries/universe-canon are NEVER touched here (they
    // belong to the universe, shareable across worlds).
    const booksOfWorld = `SELECT id FROM books WHERE world_id = $1`;
    c.ties += (await client.query(
      `DELETE FROM ties WHERE book_id IN (${booksOfWorld})`, [worldId],
    )).rowCount ?? 0;
    c.facts += (await client.query(
      `DELETE FROM facts WHERE book_id IN (${booksOfWorld})`, [worldId],
    )).rowCount ?? 0;
    c.entryFacets += (await client.query(
      `DELETE FROM entry_facets WHERE book_id IN (${booksOfWorld})`, [worldId],
    )).rowCount ?? 0;
    c.chapterAppearances += (await client.query(
      `DELETE FROM chapter_appearances WHERE book_id IN (${booksOfWorld})`, [worldId],
    )).rowCount ?? 0;
    c.chapters += (await client.query(
      `DELETE FROM chapters WHERE book_id IN (${booksOfWorld})`, [worldId],
    )).rowCount ?? 0;
    c.books += (await client.query(
      `DELETE FROM books WHERE world_id = $1`, [worldId],
    )).rowCount ?? 0;

    // UNLINK membership only. The entity rows (and universe-canon) survive.
    c.worldEntities += (await client.query(
      `DELETE FROM world_entities WHERE world_id = $1`, [worldId],
    )).rowCount ?? 0;

    // User categories owned by this world. Built-ins (world_id IS NULL) are
    // global and are NOT matched by world_id = $1, so they survive.
    c.categories += (await client.query(
      `DELETE FROM categories WHERE world_id = $1`, [worldId],
    )).rowCount ?? 0;

    // The world row itself.
    c.worlds += (await client.query(
      `DELETE FROM worlds WHERE id = $1`, [worldId],
    )).rowCount ?? 0;

    c.total = c.ties + c.facts + c.entryFacets + c.chapterAppearances + c.chapters
      + c.books + c.worldEntities + c.categories + c.worlds;
    return c;
  });
}

// ---- Chapter AI-check cache (T-AICACHE) -----------------------------------

/**
 * Persist the AI cross-check result for a chapter (idempotent upsert by
 * chapter_id). `bodyHash`/`wikiHash` stamp what the AI actually saw so a later
 * open can tell whether the cached `marks` are still fresh. Called only on a
 * SUCCESSFUL AI pass (never on a gateway error), so a failed check never
 * overwrites a good cached result. Returns the stored row (camelCase).
 */
export async function upsertChapterCheckCache(input: {
  chapterId: string;
  bodyHash: string;
  wikiHash: string;
  marks: unknown;
  checkedAt: number;
}): Promise<ChapterCheckCacheRow> {
  const res = await one<ChapterCheckCacheRow>(
    `INSERT INTO chapter_check_cache (chapter_id, body_hash, wiki_hash, marks, checked_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (chapter_id)
       DO UPDATE SET body_hash  = EXCLUDED.body_hash,
                     wiki_hash   = EXCLUDED.wiki_hash,
                     marks       = EXCLUDED.marks,
                     checked_at  = EXCLUDED.checked_at
     RETURNING chapter_id AS "chapterId",
               body_hash  AS "bodyHash",
               wiki_hash  AS "wikiHash",
               marks,
               checked_at AS "checkedAt"`,
    [input.chapterId, input.bodyHash, input.wikiHash, JSON.stringify(input.marks), input.checkedAt],
  );
  if (!res) throw new Error("upsertChapterCheckCache: no row returned");
  return res;
}
