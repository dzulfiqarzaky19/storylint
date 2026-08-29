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

// ---- Cascade preview (F7 S5 danger modal) ---------------------------------
//
// ADVISORY row-count the danger modal shows BEFORE a delete, so the writer sees
// the blast radius. It mirrors the delete predicates in mutations.ts as pure
// COUNTs (read-only, no mutation). The authoritative number is still the delete's
// summed rowCounts; the S5 gate asserts advisory === authoritative === removed.
// Book-scoped rows are counted by book_id (never NULL-canon), entries only by
// universe_id, so the preview matches exactly what the transaction will remove.

export interface CascadePreview {
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
  // W-5: world-scoped preview counts, mirroring CascadeCount so a world delete's
  // advisory total matches deleteWorldCascade's authoritative count. worldEntities
  // = junction membership rows UNLINKED (entity ROWS survive, orphan=LEAVE, never
  // counted as entries); categories = the world's user categories (built-ins have
  // world_id NULL, never counted); worlds = the world row. Every non-world preview
  // leaves these 0.
  worldEntities: number;
  categories: number;
  worlds: number;
  total: number;
}

async function countOne(sql: string, params: unknown[]): Promise<number> {
  const r = await one<{ n: string }>(sql, params);
  return r ? Number(r.n) : 0;
}

function sumPreview(
  c: Omit<CascadePreview, "total" | "worldEntities" | "categories" | "worlds"> &
    Partial<Pick<CascadePreview, "worldEntities" | "categories" | "worlds">>,
): CascadePreview {
  const worldEntities = c.worldEntities ?? 0;
  const categories = c.categories ?? 0;
  const worlds = c.worlds ?? 0;
  const total =
    c.ties + c.facts + c.entryFacets + c.chapterAppearances + c.chapters +
    c.openQuestions + c.entries + c.researchThreads + c.books + c.universes +
    worldEntities + categories + worlds;
  return { ...c, worldEntities, categories, worlds, total };
}

/** Advisory count of everything deleteUniverseCascade would remove. W-6: books
 * join to the universe through worlds (books.world_id), and series is gone. */
export async function previewUniverseCascade(universeId: string): Promise<CascadePreview> {
  const booksOf = `SELECT b.id FROM books b JOIN worlds w ON w.id = b.world_id WHERE w.universe_id = $1`;
  const entriesOf = `SELECT id FROM entries WHERE universe_id = $1`;
  const [
    tiesBook, factsBook, efBook, tiesEntry, factsEntry, efEntry, oq, appr, chap, ent, thr, bk, uni,
  ] = await Promise.all([
    countOne(`SELECT COUNT(*) AS n FROM ties WHERE book_id IN (${booksOf})`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM facts WHERE book_id IN (${booksOf})`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM entry_facets WHERE book_id IN (${booksOf})`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM ties WHERE (from_entry_id IN (${entriesOf}) OR to_entry_id IN (${entriesOf})) AND book_id IS NULL`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM facts WHERE entry_id IN (${entriesOf}) AND book_id IS NULL`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM entry_facets WHERE entry_id IN (${entriesOf}) AND book_id IS NULL`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM open_questions WHERE entry_id IN (${entriesOf})`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM chapter_appearances WHERE book_id IN (${booksOf})`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM chapters WHERE book_id IN (${booksOf})`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM entries WHERE universe_id = $1`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM research_threads WHERE universe_id = $1`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM books WHERE world_id IN (SELECT id FROM worlds WHERE universe_id = $1)`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM universes WHERE id = $1`, [universeId]),
  ]);
  return sumPreview({
    ties: tiesBook + tiesEntry,
    facts: factsBook + factsEntry,
    entryFacets: efBook + efEntry,
    chapterAppearances: appr,
    chapters: chap,
    openQuestions: oq,
    entries: ent,
    researchThreads: thr,
    books: bk,
    universes: uni,
  });
}

/** Advisory count of everything deleteBookCascade would remove. */
export async function previewBookCascade(bookId: string): Promise<CascadePreview> {
  const [ties, facts, ef, appr, chap, bk] = await Promise.all([
    countOne(`SELECT COUNT(*) AS n FROM ties WHERE book_id = $1`, [bookId]),
    countOne(`SELECT COUNT(*) AS n FROM facts WHERE book_id = $1`, [bookId]),
    countOne(`SELECT COUNT(*) AS n FROM entry_facets WHERE book_id = $1`, [bookId]),
    countOne(`SELECT COUNT(*) AS n FROM chapter_appearances WHERE book_id = $1`, [bookId]),
    countOne(`SELECT COUNT(*) AS n FROM chapters WHERE book_id = $1`, [bookId]),
    countOne(`SELECT COUNT(*) AS n FROM books WHERE id = $1`, [bookId]),
  ]);
  return sumPreview({
    ties, facts, entryFacets: ef, chapterAppearances: appr, chapters: chap,
    openQuestions: 0, entries: 0, researchThreads: 0, books: bk, universes: 0,
  });
}

/**
 * W-5/W-6 — advisory count of everything deleteWorldCascade would remove,
 * MIRRORING that mutation exactly (mutations.ts deleteWorldCascade): W-6 the
 * world's OWN books' subtree (book-scoped ties/facts/facets/appearances/chapters +
 * the books, keyed by books.world_id), then the world's world_entities junction
 * rows (membership UNLINKED), then the entities LEFT WITH ZERO links by that
 * unlink (orphan=DELETE-on-last-link — counted as entries; a still-shared entity
 * keeps a sibling link and is excluded), the world's user categories (built-ins
 * have world_id NULL and are excluded), and the world row itself. Sibling worlds,
 * universe-canon of still-shared entities, and the global built-in categories are
 * untouched, so preview.total === deleteWorldCascade(...).total by construction.
 */
export async function previewWorldCascade(worldId: string): Promise<CascadePreview> {
  const booksOf = `SELECT id FROM books WHERE world_id = $1`;
  const [ties, facts, ef, appr, chap, bk, we, cat, wo, doomedEntries] = await Promise.all([
    countOne(`SELECT COUNT(*) AS n FROM ties WHERE book_id IN (${booksOf})`, [worldId]),
    countOne(`SELECT COUNT(*) AS n FROM facts WHERE book_id IN (${booksOf})`, [worldId]),
    countOne(`SELECT COUNT(*) AS n FROM entry_facets WHERE book_id IN (${booksOf})`, [worldId]),
    countOne(`SELECT COUNT(*) AS n FROM chapter_appearances WHERE book_id IN (${booksOf})`, [worldId]),
    countOne(`SELECT COUNT(*) AS n FROM chapters WHERE book_id IN (${booksOf})`, [worldId]),
    countOne(`SELECT COUNT(*) AS n FROM books WHERE world_id = $1`, [worldId]),
    countOne(`SELECT COUNT(*) AS n FROM world_entities WHERE world_id = $1`, [worldId]),
    countOne(`SELECT COUNT(*) AS n FROM categories WHERE world_id = $1`, [worldId]),
    countOne(`SELECT COUNT(*) AS n FROM worlds WHERE id = $1`, [worldId]),
    // Entities that will DIE with this world: linked here AND to NO other world
    // (orphan=DELETE-on-last-link). A still-shared entity has another link and is
    // excluded, so this mirrors deleteWorldCascade's entry delete exactly.
    countOne(
      `SELECT COUNT(*) AS n FROM world_entities me
         WHERE me.world_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM world_entities other
              WHERE other.entity_id = me.entity_id AND other.world_id <> $1
           )`,
      [worldId],
    ),
  ]);
  return sumPreview({
    ties, facts, entryFacets: ef, chapterAppearances: appr, chapters: chap,
    openQuestions: 0, entries: doomedEntries, researchThreads: 0, books: bk, universes: 0,
    worldEntities: we, categories: cat, worlds: wo,
  });
}

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
