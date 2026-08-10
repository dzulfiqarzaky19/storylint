// Hand-written, typed, parameterized queries. Always $1/$2 placeholders, never
// string interpolation of values. Column aliases map snake_case -> camelCase so
// row shapes match domain/types.ts.
import { rows, one } from "./pool";
import { DEFAULT_BOOK_ID, DEFAULT_UNIVERSE_ID } from "./scope";
import type {
  EntryRow,
  FactRow,
  ChapterAppearanceRow,
  OpenQuestionRow,
  ResolvedTie,
  EntryWithDetails,
  WikiSnapshot,
  CategoryLabelOverrides,
  Kind,
  ChapterRow,
  ResearchTurnRow,
  PropositionRow,
  KeptCardRow,
  ResearchTurnWithCards,
  ResearchProposition,
} from "../domain/types";

// ---- Column selection fragments ------------------------------------------

const ENTRY_COLS = `
  id,
  kind,
  name,
  catalogue_no AS "catalogueNo",
  note,
  summary,
  shelf,
  sort_order AS "sortOrder",
  deleted_at AS "deletedAt"
`;

const FACT_COLS = `
  id,
  entry_id AS "entryId",
  key,
  value,
  fresh,
  sort_order AS "sortOrder"
`;

const APPEARANCE_COLS = `
  id,
  entry_id AS "entryId",
  chapter,
  text,
  flag,
  flag_text AS "flagText",
  sort_order AS "sortOrder"
`;

const OPEN_QUESTION_COLS = `
  id,
  entry_id AS "entryId",
  text,
  sort_order AS "sortOrder"
`;

// ---- Entry reads ----------------------------------------------------------

export async function getAllEntries(): Promise<EntryRow[]> {
  // F6 read-filter (behavior lock): soft-deleted entries (deleted_at set) vanish
  // from every live surface — shelves, the wiki snapshot, AND the AI gazetteer
  // built from this snapshot, so a deleted entry can never leak into AI grounding.
  return rows<EntryRow>(
    `SELECT ${ENTRY_COLS} FROM entries WHERE deleted_at IS NULL ORDER BY shelf, sort_order, name`,
  );
}

export async function getEntry(id: string): Promise<EntryRow | null> {
  // F6 read-filter (behavior lock): a soft-deleted entry is not fetchable by id
  // from any live read path.
  return one<EntryRow>(
    `SELECT ${ENTRY_COLS} FROM entries WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
}

/**
 * The "recently deleted" list (F6-S6): every soft-deleted entry, newest deletion
 * first. This is the OPPOSITE filter to getAllEntries/getEntry (which hide
 * deleted rows) — the ONE read path that surfaces tombstoned entries, for the
 * trash panel's restore + purge-countdown.
 *
 * BIGINT CAST (behavior lock): `deleted_at` is a Postgres `bigint`, which pg
 * returns as a STRING. Every other read path filters `deleted_at IS NULL`, so
 * EntryRow.deletedAt (typed `number | null`) was never populated with a real
 * value before. This is the FIRST non-null path, so it CASTs to double precision
 * — pg then returns a real JS `number`, matching the type and letting isPurgeable
 * do arithmetic on it. Drop the cast and `deletedAt` is a string, silently
 * breaking the purge-countdown math.
 */
export async function getDeletedEntries(): Promise<EntryRow[]> {
  return rows<EntryRow>(
    `SELECT
       id,
       kind,
       name,
       catalogue_no AS "catalogueNo",
       note,
       summary,
       shelf,
       sort_order AS "sortOrder",
       deleted_at::double precision AS "deletedAt"
     FROM entries
     WHERE deleted_at IS NOT NULL
     ORDER BY deleted_at DESC`,
  );
}

export async function getFactsForEntry(entryId: string): Promise<FactRow[]> {
  return rows<FactRow>(
    `SELECT ${FACT_COLS} FROM facts WHERE entry_id = $1 ORDER BY sort_order, id`,
    [entryId],
  );
}

export async function getAppearancesForEntry(
  entryId: string,
  bookId: string = DEFAULT_BOOK_ID,
): Promise<ChapterAppearanceRow[]> {
  // F7 book scope: a chapter number is only unique WITHIN a book, so an entry's
  // appearances must be filtered to the active book or a "Chapter 1" appearance
  // from a sibling book would leak into this book's wiki/timeline.
  return rows<ChapterAppearanceRow>(
    `SELECT ${APPEARANCE_COLS} FROM chapter_appearances
     WHERE entry_id = $1 AND book_id = $2 ORDER BY chapter, sort_order, id`,
    [entryId, bookId],
  );
}

export async function getOpenQuestionsForEntry(
  entryId: string,
): Promise<OpenQuestionRow[]> {
  return rows<OpenQuestionRow>(
    `SELECT ${OPEN_QUESTION_COLS} FROM open_questions
     WHERE entry_id = $1 ORDER BY sort_order, id`,
    [entryId],
  );
}

/** Ties out of an entry, joined to the target entry's display fields. */
export async function getTiesForEntry(entryId: string): Promise<ResolvedTie[]> {
  return rows<ResolvedTie>(
    `SELECT
       t.id,
       t.from_entry_id AS "fromEntryId",
       t.to_entry_id   AS "toEntryId",
       t.rel,
       e.name          AS "toName",
       e.kind          AS "toKind",
       e.catalogue_no  AS "toCatalogueNo"
     FROM ties t
     JOIN entries e ON e.id = t.to_entry_id
     WHERE t.from_entry_id = $1
     ORDER BY t.id`,
    [entryId],
  );
}

// ---- Composed reads -------------------------------------------------------

/**
 * Load the full wiki snapshot the check engine and Wiki screen consume.
 * Single set of batched reads, composed in memory (small dataset: 15 entries).
 */
export async function loadWikiSnapshot(
  universeId: string = DEFAULT_UNIVERSE_ID,
  bookId: string = DEFAULT_BOOK_ID,
): Promise<WikiSnapshot> {
  // F7 scope. Two distinct axes:
  //  - entries belong to a UNIVERSE (canon) -> filtered by universe_id.
  //  - chapter appearances belong to a BOOK (a chapter number restarts per book)
  //    -> filtered by book_id, so a sibling book's "Chapter 1" appearance can't
  //    leak into this book's timeline/wiki.
  // facts/ties/open_questions are children of an entry; they are bounded to this
  // universe's entries via `entry_id = ANY(entryIds)` (the entry set is already
  // universe-filtered), so a sibling universe's canon never attaches.
  // F7 HYBRID FACET read (S4). SCALARS (name/summary/note) are REPLACE-per-book:
  // COALESCE(entry_facets.col, entries.col) for the active book. A book that has
  // no facet row (or a NULL facet col) falls through to universe canon. With ZERO
  // facet rows this LEFT JOIN adds nothing and the snapshot is byte-identical to
  // the canon-only read (the default-book invariant the gate locks).
  const entries = await rows<EntryRow>(
    `SELECT
       e.id,
       e.kind,
       COALESCE(ef.name, e.name)       AS name,
       e.catalogue_no                  AS "catalogueNo",
       COALESCE(ef.note, e.note)       AS note,
       COALESCE(ef.summary, e.summary) AS summary,
       e.shelf,
       e.sort_order                    AS "sortOrder",
       e.deleted_at                    AS "deletedAt"
     FROM entries e
     LEFT JOIN entry_facets ef ON ef.entry_id = e.id AND ef.book_id = $2
     WHERE e.deleted_at IS NULL AND e.universe_id = $1
     ORDER BY e.shelf, e.sort_order, name`,
    [universeId, bookId],
  );
  const entryIds = entries.map((e) => e.id);

  const [facts, appearances, openQuestions, ties, labelRows] = await Promise.all([
    // F7 list divergence (S4): facts are ADDITIVE, not override. book_id IS NULL
    // = universe canon (shows in EVERY book); book_id = active book = book-only.
    // The OR-predicate UNIONs both sets; ORDER BY (sort_order, id) INTERLEAVES a
    // book-only fact at its own sort position (canon-first would silently reorder
    // every existing list the moment one book-fact is added). id is the tiebreak,
    // so the order is deterministic. Dropping the `book_id IS NULL` term drops
    // canon; dropping `book_id = $2` drops book-only rows — both gate-locked.
    rows<FactRow>(
      `SELECT ${FACT_COLS} FROM facts
        WHERE entry_id = ANY($1) AND (book_id IS NULL OR book_id = $2)
        ORDER BY sort_order, id`,
      [entryIds, bookId],
    ),
    rows<ChapterAppearanceRow>(
      `SELECT ${APPEARANCE_COLS} FROM chapter_appearances
        WHERE book_id = $1 ORDER BY chapter, sort_order, id`,
      [bookId],
    ),
    rows<OpenQuestionRow>(
      `SELECT ${OPEN_QUESTION_COLS} FROM open_questions
        WHERE entry_id = ANY($1) ORDER BY sort_order, id`,
      [entryIds],
    ),
    // F7 (S4): ties are ADDITIVE like facts (book_id IS NULL OR = active book),
    // AND the tie's displayed TARGET name is facet-merged for the active book —
    // if this book renames the target entry, a tie pointing at it must read the
    // book's name or the book contradicts itself. The JOIN to entries stays INNER
    // (the target must exist); only the facet join (ef2) is LEFT. book_id scoping
    // on ef2 keeps a book's target-rename out of sibling books.
    rows<ResolvedTie>(
      `SELECT
         t.id,
         t.from_entry_id AS "fromEntryId",
         t.to_entry_id   AS "toEntryId",
         t.rel,
         COALESCE(ef2.name, e.name) AS "toName",
         e.kind          AS "toKind",
         e.catalogue_no  AS "toCatalogueNo"
       FROM ties t
       JOIN entries e ON e.id = t.to_entry_id
       LEFT JOIN entry_facets ef2 ON ef2.entry_id = t.to_entry_id AND ef2.book_id = $2
       WHERE t.from_entry_id = ANY($1) AND (t.book_id IS NULL OR t.book_id = $2)
       ORDER BY t.id`,
      [entryIds, bookId],
    ),
    rows<{ kind: Kind; label: string }>(`SELECT kind, label FROM category_labels`),
  ]);

  const byId: Record<string, EntryWithDetails> = {};
  for (const entry of entries) {
    byId[entry.id] = {
      ...entry,
      facts: [],
      ties: [],
      appearances: [],
      openQuestions: [],
    };
  }

  for (const f of facts) byId[f.entryId]?.facts.push(f);
  for (const a of appearances) byId[a.entryId]?.appearances.push(a);
  for (const q of openQuestions) byId[q.entryId]?.openQuestions.push(q);
  for (const t of ties) byId[t.fromEntryId]?.ties.push(t);

  const composed = entries.map((e) => byId[e.id]!);
  const overrides: CategoryLabelOverrides = {};
  for (const r of labelRows) overrides[r.kind] = r.label;
  return { entries: composed, byId, overrides };
}

/**
 * A single entry with all its details (Wiki detail view), MERGED for the active
 * book (S4 hybrid facet layer). Scalars are COALESCE(facet, canon); facts/ties
 * are the ADDITIVE UNION (canon book_id IS NULL + book-only book_id=$bookId),
 * and a tie's target name is facet-merged for the book — the same merge
 * loadWikiSnapshot applies, scoped to one entry. Defaults to book-1 so existing
 * callers (wiki.ts) read canon exactly as before (zero facet rows => all
 * COALESCE/OR terms are no-ops on canon-only data). The bare getFactsForEntry /
 * getTiesForEntry stay canon-only by design (not widened this slice).
 */
export async function getEntryWithDetails(
  id: string,
  bookId: string = DEFAULT_BOOK_ID,
): Promise<EntryWithDetails | null> {
  const entry = await one<EntryRow>(
    `SELECT
       e.id,
       e.kind,
       COALESCE(ef.name, e.name)       AS name,
       e.catalogue_no                  AS "catalogueNo",
       COALESCE(ef.note, e.note)       AS note,
       COALESCE(ef.summary, e.summary) AS summary,
       e.shelf,
       e.sort_order                    AS "sortOrder",
       e.deleted_at                    AS "deletedAt"
     FROM entries e
     LEFT JOIN entry_facets ef ON ef.entry_id = e.id AND ef.book_id = $2
     WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [id, bookId],
  );
  if (!entry) return null;
  const [facts, ties, appearances, openQuestions] = await Promise.all([
    rows<FactRow>(
      `SELECT ${FACT_COLS} FROM facts
        WHERE entry_id = $1 AND (book_id IS NULL OR book_id = $2)
        ORDER BY sort_order, id`,
      [id, bookId],
    ),
    rows<ResolvedTie>(
      `SELECT
         t.id,
         t.from_entry_id AS "fromEntryId",
         t.to_entry_id   AS "toEntryId",
         t.rel,
         COALESCE(ef2.name, e.name) AS "toName",
         e.kind          AS "toKind",
         e.catalogue_no  AS "toCatalogueNo"
       FROM ties t
       JOIN entries e ON e.id = t.to_entry_id
       LEFT JOIN entry_facets ef2 ON ef2.entry_id = t.to_entry_id AND ef2.book_id = $2
       WHERE t.from_entry_id = $1 AND (t.book_id IS NULL OR t.book_id = $2)
       ORDER BY t.id`,
      [id, bookId],
    ),
    getAppearancesForEntry(id, bookId),
    getOpenQuestionsForEntry(id),
  ]);
  return { ...entry, facts, ties, appearances, openQuestions };
}

// ---- Write screen ---------------------------------------------------------

export async function getChapter(
  number: number,
  bookId: string = DEFAULT_BOOK_ID,
): Promise<ChapterRow | null> {
  // F7 book scope: chapter `number` is unique only WITHIN a book, so the lookup
  // must carry the book or getChapter(1) would ambiguously match every book's
  // Chapter 1 and silently return one of them.
  return one<ChapterRow>(
    `SELECT id, number, title, body FROM chapters WHERE number = $1 AND book_id = $2`,
    [number, bookId],
  );
}

// ---- Chapters (list) ------------------------------------------------------
// Append-only section (Track C). Does NOT modify existing functions.

/**
 * List every chapter as {id, number, title}, ordered by number. Deliberately
 * omits the (large) body so the Write left index stays light — the selected
 * chapter's body is loaded separately via getChapter(number).
 */
export async function listChapters(): Promise<
  { id: string; number: number; title: string }[]
> {
  return rows<{ id: string; number: number; title: string }>(
    `SELECT id, number, title FROM chapters ORDER BY number`,
  );
}

/**
 * List every chapter WITH its body (ProseMirror JSON), ordered by number. Unlike
 * listChapters (which omits the body to keep the left index light), this feeds
 * the Feature-1 per-chapter severity pass, which must run the engine over every
 * chapter's text on load. One round-trip for all chapters, not one per chapter.
 * The body column is jsonb; the pg driver hands it back already parsed.
 */
export async function getAllChaptersWithBody(): Promise<ChapterRow[]> {
  return rows<ChapterRow>(
    `SELECT id, number, title, body FROM chapters ORDER BY number`,
  );
}

export async function getResolvedMarkKeys(): Promise<string[]> {
  const res = await rows<{ markKey: string }>(
    `SELECT mark_key AS "markKey" FROM resolved_marks`,
  );
  return res.map((r) => r.markKey);
}

export async function getDismissedSuggestionKeys(): Promise<string[]> {
  const res = await rows<{ suggestionKey: string }>(
    `SELECT suggestion_key AS "suggestionKey" FROM dismissed_suggestions`,
  );
  return res.map((r) => r.suggestionKey);
}

/**
 * Book-wide cross-chapter recurrence index (Tier 2), SCOPED to the phrases the
 * caller actually needs. For each requested phrase, how many DISTINCT chapters
 * it appears in BOOK-WIDE. The engine ranks an unrecorded mark 'high' when its
 * phrase recurs across >= 2 chapters (rank, never gate). Keys are the canonical
 * phraseIndexKey form stored by extractCandidatePhrases (lowercased +
 * apostrophe-folded), so the engine's phraseIndexKey lookup matches. Returns a
 * Map for O(1) lookup in checkManuscript.
 *
 * `phrases` narrows WHICH rows are fetched (the write page only ever looks up
 * the phrases on the CURRENT chapter, so we no longer serialize the entire
 * book-wide index to the client every load). It does NOT narrow the recurrence
 * count: COUNT(DISTINCT chapter_number) is still evaluated over ALL of a
 * phrase's rows, so a phrase in ch3 + ch7 still returns 2 even when the lookup
 * is issued from ch3. Scoping the WHERE must never shrink the DISTINCT-chapter
 * aggregate — that is the whole correctness contract of this function. An empty
 * `phrases` array returns an empty Map (nothing to rank).
 */
export async function getPhraseChapterCounts(
  phrases: readonly string[],
): Promise<Map<string, number>> {
  if (phrases.length === 0) return new Map();
  const res = await rows<{ phrase: string; chapters: number }>(
    `SELECT phrase, COUNT(DISTINCT chapter_number)::int AS chapters
       FROM phrase_mentions
      WHERE phrase = ANY($1)
      GROUP BY phrase`,
    [phrases as string[]],
  );
  return new Map(res.map((r) => [r.phrase, r.chapters]));
}

// ---- Research screen ------------------------------------------------------

export async function getResearchThread(
  threadId: string,
): Promise<ResearchTurnWithCards[]> {
  const [turns, props, kept] = await Promise.all([
    rows<ResearchTurnRow>(
      `SELECT id, thread_id AS "threadId", ordinal, side, who, text
       FROM research_turns WHERE thread_id = $1 ORDER BY ordinal`,
      [threadId],
    ),
    rows<PropositionRow>(
      `SELECT p.id, p.turn_id AS "turnId", p.kind, p.title, p.body,
              p.as_kind AS "asKind", p.sort_order AS "sortOrder"
       FROM propositions p
       JOIN research_turns t ON t.id = p.turn_id
       WHERE t.thread_id = $1
       ORDER BY p.sort_order, p.id`,
      [threadId],
    ),
    rows<KeptCardRow>(
      `SELECT proposition_id AS "propositionId", kept_at AS "keptAt", in_wiki AS "inWiki"
       FROM kept_cards`,
    ),
  ]);

  const keptById = new Map(kept.map((k) => [k.propositionId, k]));
  const cardsByTurn = new Map<string, ResearchProposition[]>();
  for (const p of props) {
    const k = keptById.get(p.id);
    const card: ResearchProposition = {
      ...p,
      kept: Boolean(k),
      inWiki: k?.inWiki ?? false,
    };
    const list = cardsByTurn.get(p.turnId) ?? [];
    list.push(card);
    cardsByTurn.set(p.turnId, list);
  }

  return turns.map((t) => ({ ...t, cards: cardsByTurn.get(t.id) ?? [] }));
}

// ---- Research threads (Track B — multi-thread sidebar) --------------------
// APPEND-ONLY: read for the Gemini-style thread list on the Research screen.
// Ordered by sort_order (the seeded thread order). Read-only; no existing
// query above is modified.

/**
 * List every research thread for the LEFT sidebar, in sort_order (then id as a
 * stable tiebreaker so newly-created threads sharing a sort_order are ordered
 * deterministically). Column aliases map snake_case -> camelCase.
 */
export async function listResearchThreads(): Promise<
  import("../domain/types").ResearchThreadRow[]
> {
  return rows<import("../domain/types").ResearchThreadRow>(
    `SELECT id, title, subtitle, sort_order AS "sortOrder", scope
     FROM research_threads
     ORDER BY sort_order, id`,
  );
}

// ---- World tree (F7 S5 switcher) ------------------------------------------
//
// The top-bar picker needs the whole world SKELETON: every universe, its
// series, and each series' books, NESTED. The nesting is the load-bearing part:
// a series is grouped under its universe by `series.universe_id === universe.id`
// and a book under its series by `book.series_id === series.id`. Dropping either
// parent predicate flattens or mis-nests the tree (a book would surface under the
// wrong series/universe in the picker), so both are mutation-locked in the S5
// test. Ordered by sort_order then id for a stable, deterministic picker.

export interface WorldBookNode {
  id: string;
  name: string;
  sortOrder: number;
}

export interface WorldSeriesNode {
  id: string;
  name: string;
  sortOrder: number;
  books: WorldBookNode[];
}

export interface WorldUniverseNode {
  id: string;
  name: string;
  series: WorldSeriesNode[];
}

export async function getWorldTree(): Promise<WorldUniverseNode[]> {
  const universes = await rows<{ id: string; name: string }>(
    `SELECT id, name FROM universes ORDER BY id`,
  );
  const series = await rows<{ id: string; name: string; universeId: string; sortOrder: number }>(
    `SELECT id, name, universe_id AS "universeId", sort_order AS "sortOrder"
       FROM series ORDER BY sort_order, id`,
  );
  const books = await rows<{ id: string; name: string; seriesId: string; sortOrder: number }>(
    `SELECT id, name, series_id AS "seriesId", sort_order AS "sortOrder"
       FROM books ORDER BY sort_order, id`,
  );

  // NEST — each book under its series (book.seriesId === series.id), each series
  // under its universe (series.universeId === universe.id). These two equalities
  // are the tree's structure; the S5 test mutates each to prove it.
  return universes.map((u) => ({
    id: u.id,
    name: u.name,
    series: series
      .filter((se) => se.universeId === u.id)
      .map((se) => ({
        id: se.id,
        name: se.name,
        sortOrder: se.sortOrder,
        books: books
          .filter((b) => b.seriesId === se.id)
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
  series: number;
  universes: number;
  total: number;
}

async function countOne(sql: string, params: unknown[]): Promise<number> {
  const r = await one<{ n: string }>(sql, params);
  return r ? Number(r.n) : 0;
}

function sumPreview(c: Omit<CascadePreview, "total">): CascadePreview {
  const total =
    c.ties + c.facts + c.entryFacets + c.chapterAppearances + c.chapters +
    c.openQuestions + c.entries + c.researchThreads + c.books + c.series + c.universes;
  return { ...c, total };
}

/** Advisory count of everything deleteUniverseCascade would remove. */
export async function previewUniverseCascade(universeId: string): Promise<CascadePreview> {
  const booksOf = `SELECT b.id FROM books b JOIN series s ON s.id = b.series_id WHERE s.universe_id = $1`;
  const entriesOf = `SELECT id FROM entries WHERE universe_id = $1`;
  const [
    tiesBook, factsBook, efBook, tiesEntry, factsEntry, efEntry, oq, appr, chap, ent, thr, bk, se, uni,
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
    countOne(`SELECT COUNT(*) AS n FROM books WHERE series_id IN (SELECT id FROM series WHERE universe_id = $1)`, [universeId]),
    countOne(`SELECT COUNT(*) AS n FROM series WHERE universe_id = $1`, [universeId]),
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
    series: se,
    universes: uni,
  });
}

/** Advisory count of everything deleteSeriesCascade would remove. */
export async function previewSeriesCascade(seriesId: string): Promise<CascadePreview> {
  const booksOf = `SELECT id FROM books WHERE series_id = $1`;
  const [ties, facts, ef, appr, chap, bk, se] = await Promise.all([
    countOne(`SELECT COUNT(*) AS n FROM ties WHERE book_id IN (${booksOf})`, [seriesId]),
    countOne(`SELECT COUNT(*) AS n FROM facts WHERE book_id IN (${booksOf})`, [seriesId]),
    countOne(`SELECT COUNT(*) AS n FROM entry_facets WHERE book_id IN (${booksOf})`, [seriesId]),
    countOne(`SELECT COUNT(*) AS n FROM chapter_appearances WHERE book_id IN (${booksOf})`, [seriesId]),
    countOne(`SELECT COUNT(*) AS n FROM chapters WHERE book_id IN (${booksOf})`, [seriesId]),
    countOne(`SELECT COUNT(*) AS n FROM books WHERE series_id = $1`, [seriesId]),
    countOne(`SELECT COUNT(*) AS n FROM series WHERE id = $1`, [seriesId]),
  ]);
  return sumPreview({
    ties, facts, entryFacets: ef, chapterAppearances: appr, chapters: chap,
    openQuestions: 0, entries: 0, researchThreads: 0, books: bk, series: se, universes: 0,
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
    openQuestions: 0, entries: 0, researchThreads: 0, books: bk, series: 0, universes: 0,
  });
}
