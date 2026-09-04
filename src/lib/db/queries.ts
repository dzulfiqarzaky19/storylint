// Hand-written, typed, parameterized queries. Always $1/$2 placeholders, never
// string interpolation of values. Column aliases map snake_case -> camelCase so
// row shapes match domain/types.ts.
import { rows, one } from "./pool";

// ---- Gazetteer (T-ARCH-2 shim; SQL lives in gazetteer.ts) ----
export {
  getAllEntries,
  getWorldEntries,
  getEntry,
  getDeletedEntries,
  getFactsForEntry,
  getAppearancesForEntry,
  getOpenQuestionsForEntry,
  getTiesForEntry,
  getCategories,
  loadWikiSnapshot,
  loadWorldSnapshot,
  getEntryWithDetails,
} from "./gazetteer";

// ---- Write screen / chapters (T-ARCH-2 shim; SQL lives in chapter-queries.ts) ----
export {
  getChapter,
  listChapters,
  getAllChaptersWithBody,
  getResolvedMarkKeys,
  getDismissedSuggestionKeys,
  getPhraseChapterCounts,
} from "./chapter-queries";

// ---- Research screen (T-ARCH-2 shim; SQL lives in research-queries.ts) ----
export {
  getResearchThread,
  listResearchThreads,
  getResearchThreadWorldId,
  getWorldKeptCards,
} from "./research-queries";

// ---- World tree (F7 S5 switcher) ------------------------------------------
//
// The top-bar picker needs the whole world SKELETON: every universe, its worlds,
// and each world's books, NESTED. W-6: books hang off WORLDS now (books.world_id),
// so the nesting is universe -> world -> book. The nesting is the load-bearing
// part: a world is grouped under its universe by `world.universe_id ===
// universe.id` and a book under its world by `book.world_id === world.id`.
// Dropping either parent predicate flattens or mis-nests the tree (a book would
// surface under the wrong world/universe in the picker), so both are
// mutation-locked. Ordered by sort_order then id for a stable picker.

export interface WorldBookNode {
  id: string;
  name: string;
  sortOrder: number;
}

export interface WorldNode {
  id: string;
  title: string;
  sortOrder: number;
  books: WorldBookNode[];
}

export interface WorldUniverseNode {
  id: string;
  name: string;
  /**
   * TCK-022 (W-4a) / W-6: the universe's REAL worlds (from the `worlds` table),
   * ordered by sort_order, each carrying its OWN books (W-6: books.world_id).
   * Ordered by sort_order (then id as a stable tiebreak) so the switcher order is
   * deterministic.
   */
  worlds: WorldNode[];
}

export async function getWorldTree(): Promise<WorldUniverseNode[]> {
  const universes = await rows<{ id: string; name: string }>(
    `SELECT id, name FROM universes ORDER BY id`,
  );
  const books = await rows<{ id: string; name: string; worldId: string; sortOrder: number }>(
    `SELECT id, name, world_id AS "worldId", sort_order AS "sortOrder"
       FROM books ORDER BY sort_order, id`,
  );
  // The real per-universe world list, ordered by sort_order then id so the
  // switcher renders a stable order. Fetched once and grouped in memory.
  const worlds = await rows<{ id: string; title: string; universeId: string; sortOrder: number }>(
    `SELECT id, title, universe_id AS "universeId", sort_order AS "sortOrder"
       FROM worlds ORDER BY sort_order, id`,
  );

  // NEST — each book under its world (book.worldId === world.id), each world under
  // its universe (world.universeId === universe.id). These two equalities are the
  // tree's structure; the getWorldTree test mutates each to prove it.
  return universes.map((u) => ({
    id: u.id,
    name: u.name,
    worlds: worlds
      .filter((w) => w.universeId === u.id)
      .map((w) => ({
        id: w.id,
        title: w.title,
        sortOrder: w.sortOrder,
        books: books
          .filter((b) => b.worldId === w.id)
          .map((b) => ({ id: b.id, name: b.name, sortOrder: b.sortOrder })),
      })),
  }));
}

// ---- Cascade (F7 S5 danger modal) -----------------------------------------
//
// The advisory row-count the danger modal shows BEFORE a delete now runs the
// SAME plan the delete runs (lib/db/cascade.ts), so the preview's predicates and
// the delete's predicates cannot drift apart — they are one list.
export { previewCascade, deleteCascade } from "./cascade";
export type { CascadeCount, CascadeTarget } from "./cascade";

// ---- F8 / chapter-check cache (T-ARCH-2 shim; SQL lives in chapter-queries.ts) ----
export {
  getChaptersForBook,
  getChapterCheckCache,
} from "./chapter-queries";

/** The book's title (books.name), or null when the id matches no book. */
export async function getBook(bookId: string): Promise<{ title: string } | null> {
  return one<{ title: string }>(
    `SELECT name AS title FROM books WHERE id = $1`,
    [bookId],
  );
}

/**
 * How many siblings the given world/book shares its parent with, counting itself.
 * Backs the last-child guard: a universe must keep at least one world, a world at
 * least one book. Returns 0 when the id matches nothing.
 */
export async function countStructureSiblings(
  level: "world" | "book",
  id: string,
): Promise<number> {
  const sql =
    level === "world"
      ? `SELECT COUNT(*) AS n FROM worlds
          WHERE universe_id = (SELECT universe_id FROM worlds WHERE id = $1)`
      : `SELECT COUNT(*) AS n FROM books
          WHERE world_id = (SELECT world_id FROM books WHERE id = $1)`;
  const r = await one<{ n: string }>(sql, [id]);
  return r ? Number(r.n) : 0;
}
