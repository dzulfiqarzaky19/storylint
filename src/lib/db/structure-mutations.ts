// Structural write helpers for the worlds hierarchy: universe/world/book renames
// + creation, and the three delete-cascade transactions. Split out of the former
// mutations.ts (T-ARCH-16), which is now a shim barrel. STRUCTURAL — these touch
// the world skeleton, never wiki CONTENT, so they take NO WikiWriteConfirmation
// token (product rule 1 gates entries/facts/facets, not the hierarchy). Same SQL
// rules as before: always $1/$2 placeholders, snake_case columns aliased to camel.

import { randomUUID } from "node:crypto";
import { query, one, withTransaction } from "./pool";
import { DEFAULT_WORLD_ID } from "./scope";

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
// Deleting a universe / world / book destroys its whole subtree. That lives in
// ./cascade.ts, where the delete and the danger modal's preview run ONE ordered
// plan — the invariants used to be prose asking you not to reorder two lists.
