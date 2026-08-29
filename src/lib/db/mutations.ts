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
import { query, one, withTransaction } from "./pool";
import { DEFAULT_WORLD_ID } from "./scope";

// ---- Gazetteer (T-ARCH-2 shim; SQL lives in gazetteer-mutations.ts) ----
export {
  insertFact,
  updateFactEntry,
  clearFactFresh,
  updateEntryShelfOrder,
  insertEntry,
  insertEntryLinkedToWorld,
  softDeleteEntry,
  restoreEntry,
  purgeDeletedBefore,
  reorderShelf,
  insertTie,
  deleteTie,
  createEntryWithTie,
  getMaxSortOrderForShelf,
  getMaxSortOrderForFacts,
  getMaxCategorySortOrder,
  createCategory,
  renameCategory,
  resetCategoryLabel,
  deleteCategory,
  updateEntryFields,
  updateFact,
  linkEntityToWorld,
  unlinkEntityFromWorld,
  upsertEntryFacet,
} from "./gazetteer-mutations";
export type { EntryFacetRow } from "./gazetteer-mutations";

// ---- Chapters (manuscript) (T-ARCH-2 shim; SQL lives in chapter-mutations.ts) ----
export {
  saveChapterBody,
  replacePhraseMentions,
  getNextChapterNumber,
  insertChapter,
  renameChapter,
  countChaptersInBook,
  deleteChapter,
  upsertResolvedMark,
} from "./chapter-mutations";

// ---- Kept cards (Research) (T-ARCH-2 shim; SQL lives in research-mutations.ts) ----
export {
  upsertKeptCard,
  deleteKeptCard,
  markKeptInWiki,
} from "./research-mutations";

// ---- Dismissed suggestions (T-ARCH-2 shim; SQL lives in chapter-mutations.ts) ----
export { insertDismissedSuggestion } from "./chapter-mutations";

// ---- Reads used by mutation paths -----------------------------------------
// These are SELECTs, but they live here (not queries.ts) because they exist
// solely to support the write paths above (e.g. confirmCard needs the source
// proposition and the next free sortOrder). Keeping them beside their callers
// avoids concurrent edits to the shared read layer.

export { getProposition } from "./research-mutations";

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

// ---- Research threads/turns (T-ARCH-2 shim; SQL lives in research-mutations.ts) ----
export {
  getNextResearchThreadSortOrder,
  insertResearchThread,
  insertResearchTurnPair,
  deleteThread,
  deleteLastThreadGuarded,
  updateThreadTitle,
} from "./research-mutations";
export type {
  ResearchCardInput,
  ResearchTurnPairInput,
  PersistedTurnRef,
} from "./research-mutations";

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
 * THE INVARIANT (orphan=DELETE-on-last-link): a shared entity survives ONLY while
 * some world still links it. This world's membership rows are unlinked; an entity
 * still linked to a SIBLING world lives on there, but one whose LAST link was here
 * is deleted (its ON DELETE CASCADE children go with it). An entity with zero world
 * links is unreachable dead data, never a kept orphan. Deleting the world also
 * drops its user categories; the 4 built-ins (world_id IS NULL) are GLOBAL and
 * SURVIVE so a shared entity kind still resolves in any world.
 *
 * Explicit COUNTED deletes in one transaction (never an implicit FK cascade, so
 * total is exact and count === rows-removed holds by construction), leaf->root:
 * book subtree -> junction -> now-orphaned entities -> user categories -> world.
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

    // The entities linked to THIS world, captured BEFORE we unlink them, so we can
    // tell afterwards which ones lost their last link (orphan=DELETE-on-last-link).
    const linkedHere = (await client.query<{ entity_id: string }>(
      `SELECT entity_id FROM world_entities WHERE world_id = $1`, [worldId],
    )).rows.map((r) => r.entity_id);

    // UNLINK this world's membership rows. An entity shared into a SIBLING world
    // keeps that link and survives; an entity whose ONLY link was here is now
    // orphaned and deleted below.
    c.worldEntities += (await client.query(
      `DELETE FROM world_entities WHERE world_id = $1`, [worldId],
    )).rowCount ?? 0;

    // Delete the entities left with ZERO links after the unlink (their ON DELETE
    // CASCADE children — facts/ties/facets/appearances/open_questions/plotline
    // edges — go with them). Universe-canon of a STILL-shared entity is untouched.
    if (linkedHere.length > 0) {
      c.entries += (await client.query(
        `DELETE FROM entries e
          WHERE e.id = ANY($1)
            AND NOT EXISTS (SELECT 1 FROM world_entities we WHERE we.entity_id = e.id)`,
        [linkedHere],
      )).rowCount ?? 0;
    }

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
      + c.books + c.worldEntities + c.entries + c.categories + c.worlds;
    return c;
  });
}

// ---- Chapter AI-check cache (T-AICACHE) -----------------------------------

// ---- Chapter AI-check cache (T-ARCH-2 shim; SQL lives in chapter-mutations.ts) ----
export { upsertChapterCheckCache } from "./chapter-mutations";
