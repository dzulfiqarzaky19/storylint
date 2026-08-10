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

import { query, one, rows, withTransaction } from "./pool";
import { DEFAULT_BOOK_ID, DEFAULT_SERIES_ID, DEFAULT_UNIVERSE_ID } from "./scope";
import type { FactRow, TieRow, ResolvedMarkRow, KeptCardRow, PropositionRow, Kind } from "../domain/types";
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

// ---- Category labels + category "delete" (F6-S5) --------------------------
//
// `category_labels(kind PK, label)` overrides the header text for a fixed kind
// enum (reads coalesce label ?? SHELF_TITLES default via resolveCategoryLabel).
// The table has NO FK to entries — a rename/reset never touches an entry, fact,
// or tie, so it is NOT a wiki-knowledge write (product rule 1) and needs no
// confirmation token. "Delete category" is the one exception: it is a BULK
// soft-delete of every entry of that kind, so it reuses the S2 softDeleteEntry
// gate and DEMANDS a WikiWriteConfirmation.

/** Read every category-label override (kind -> custom header text). */
export async function getCategoryLabels(): Promise<{ kind: Kind; label: string }[]> {
  return rows<{ kind: Kind; label: string }>(
    `SELECT kind, label FROM category_labels`,
  );
}

/**
 * Set (rename) the display label for a category. Upsert on the kind PK so a
 * second rename overwrites the first. TRIMS the input and treats an empty/
 * whitespace-only label as a no-op (never upserts a blank, which would render a
 * BLANK header — the resolver's `??` only catches null/undefined, not ""). Use
 * resetCategoryLabel to explicitly clear an override. No token: category_labels
 * touches no wiki entry/fact/tie, so product rule 1 does not apply.
 */
export async function renameCategory(input: {
  kind: Kind;
  label: string;
}): Promise<void> {
  const label = input.label.trim();
  if (label === "") return; // blank rename is a no-op, not a blanked header
  await query(
    `INSERT INTO category_labels (kind, label)
     VALUES ($1, $2)
     ON CONFLICT (kind) DO UPDATE SET label = EXCLUDED.label`,
    [input.kind, label],
  );
}

/**
 * Reset a category to its default header by DELETING its override row (the read
 * path then coalesces to SHELF_TITLES). Idempotent: deleting an absent row is a
 * harmless no-op. No token (same rationale as renameCategory).
 */
export async function resetCategoryLabel(kind: Kind): Promise<void> {
  await query(`DELETE FROM category_labels WHERE kind = $1`, [kind]);
}

/**
 * "Delete" a category: SOFT-delete every LIVE entry of that kind in one pass, so
 * their ties/references render the existing S2 "removed" tombstones. The kind
 * enum + shelf header STAY (the enum is a fixed CHECK constraint; the category
 * just goes empty). Reuses the S2 soft-delete semantics: stamp `deleted_at`
 * WITHOUT removing rows, guarded by `deleted_at IS NULL` so re-running preserves
 * the original timestamps (idempotent). REQUIRES a confirmation token — it is a
 * bulk, high-consequence soft-delete. Returns the number of entries deleted.
 */
export async function deleteCategory(
  input: { kind: Kind; deletedAt: number },
  _confirmation: WikiWriteConfirmation,
): Promise<number> {
  const res = await query(
    `UPDATE entries SET deleted_at = $2 WHERE kind = $1 AND deleted_at IS NULL`,
    [input.kind, input.deletedAt],
  );
  return res.rowCount ?? 0;
}

// ---- Research threads (Track B — multi-thread sidebar) --------------------
// APPEND-ONLY: writes for "New thread". Creating a thread is NOT a wiki write
// (product rule 1), so it needs no confirmation token — it only adds an empty
// conversation column, never an entry. No existing helper above is modified.

/** Next free sort_order for a new research thread (max + 1, or 0 if none). */
export async function getNextResearchThreadSortOrder(): Promise<number> {
  const res = await rows<{ maxSort: number | null }>(
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
}): Promise<import("../domain/types").ResearchThreadRow> {
  // F7: research_threads.universe_id is NOT NULL as of the S1b contract; a new
  // thread is grounded in the active universe's canon by default.
  const res = await one<import("../domain/types").ResearchThreadRow>(
    `INSERT INTO research_threads (id, title, subtitle, sort_order, scope, universe_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, subtitle, sort_order AS "sortOrder", scope`,
    [input.id, input.title, input.subtitle, input.sortOrder, input.scope, input.universeId ?? DEFAULT_UNIVERSE_ID],
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

// ---- F7 worlds hierarchy: structural creation (Universe/Series/Book) --------
//
// These INSERT the STRUCTURAL rows of the worlds hierarchy. They are NOT wiki
// content, so per product rule 1 they take NO WikiWriteConfirmation token (same
// as createChapter).
//
// CONTINUATION vs FRESH is pure ROUTING, not a canon copy — ratified by chick
// (data-model gate) on schema evidence:
//   * CONTINUATION = a new Series/Book under an EXISTING universe. The new book
//     reuses that universe's canon BY CONSTRUCTION: canon entries carry the
//     universe_id (loadWikiSnapshot filters on it) and canon facts/ties carry
//     book_id = NULL, so they surface in every book of the universe. NO row is
//     copied — a physical copy would DOUBLE canon (two `entries` rows for one
//     character) and break the single-source assumption the merge relies on.
//   * FRESH = a NEW universe (+ its first series and book). Its wiki is empty by
//     construction because no entries carry the new universe_id yet.
// So the fresh/continuation flag is simply WHICH universe_id the new structural
// rows get: an existing one (continuation) or a newly-minted one (fresh).

export interface UniverseRow {
  id: string;
  name: string;
}
export interface SeriesRow {
  id: string;
  universeId: string;
  name: string;
  sortOrder: number;
}
export interface BookRow {
  id: string;
  seriesId: string;
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
 * Insert a series under a universe (CONTINUATION routing: default = active
 * universe, so the new series reuses that universe's canon by construction).
 */
export async function insertSeries(input: {
  id: string;
  name: string;
  universeId?: string;
  sortOrder?: number;
}): Promise<SeriesRow> {
  const res = await one<SeriesRow>(
    `INSERT INTO series (id, universe_id, name, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, universe_id AS "universeId", name, sort_order AS "sortOrder"`,
    [input.id, input.universeId ?? DEFAULT_UNIVERSE_ID, input.name, input.sortOrder ?? 0],
  );
  if (!res) throw new Error("insertSeries: no row returned");
  return res;
}

/**
 * Insert a book under a series (CONTINUATION routing: default = active series).
 * A new book starts EMPTY, so getNextChapterNumber(newBook) = 1 by construction
 * (COALESCE(MAX(number),0)+1 over zero chapters).
 */
export async function insertBook(input: {
  id: string;
  name: string;
  seriesId?: string;
  sortOrder?: number;
}): Promise<BookRow> {
  const res = await one<BookRow>(
    `INSERT INTO books (id, series_id, name, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, series_id AS "seriesId", name, sort_order AS "sortOrder"`,
    [input.id, input.seriesId ?? DEFAULT_SERIES_ID, input.name, input.sortOrder ?? 0],
  );
  if (!res) throw new Error("insertBook: no row returned");
  return res;
}

/**
 * FRESH world: create a NEW universe plus its first series and first book, in
 * ONE transaction so a universe never lands without a home for chapters. The new
 * universe's wiki is empty by construction (no entries carry its universe_id).
 * This is the "fresh" branch; continuation instead calls insertSeries/insertBook
 * against an existing universe_id.
 */
export async function createFreshUniverse(input: {
  universeId: string;
  seriesId: string;
  bookId: string;
  universeName: string;
  seriesName?: string;
  bookName?: string;
}): Promise<{ universe: UniverseRow; series: SeriesRow; book: BookRow }> {
  return withTransaction(async (client) => {
    const uni = await client.query<UniverseRow>(
      `INSERT INTO universes (id, name) VALUES ($1, $2) RETURNING id, name`,
      [input.universeId, input.universeName],
    );
    const ser = await client.query<SeriesRow>(
      `INSERT INTO series (id, universe_id, name, sort_order)
       VALUES ($1, $2, $3, 0)
       RETURNING id, universe_id AS "universeId", name, sort_order AS "sortOrder"`,
      [input.seriesId, input.universeId, input.seriesName ?? input.universeName],
    );
    const bk = await client.query<BookRow>(
      `INSERT INTO books (id, series_id, name, sort_order)
       VALUES ($1, $2, $3, 0)
       RETURNING id, series_id AS "seriesId", name, sort_order AS "sortOrder"`,
      [input.bookId, input.seriesId, input.bookName ?? input.seriesName ?? input.universeName],
    );
    // INSERT ... RETURNING always yields exactly one row.
    return { universe: uni.rows[0]!, series: ser.rows[0]!, book: bk.rows[0]! };
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
