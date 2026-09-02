// /wiki gazetteer READ layer. SQL for entries, facts, ties, categories,
// world_entities, appearances, open_questions, facets. A chapter/research
// edit in queries.ts cannot break the wiki rail.
import { rows, one } from "../pool";
import { DEFAULT_BOOK_ID } from "../scope";
import type {
  EntryRow,
  FactRow,
  ChapterAppearanceRow,
  OpenQuestionRow,
  ResolvedTie,
  CategoryRow,
} from "../../domain/types";

// ---- Column selection fragments (shared with snapshots.ts) ----------------
export const ENTRY_COLS = `
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

export const FACT_COLS = `
  id,
  entry_id AS "entryId",
  key,
  value,
  fresh,
  sort_order AS "sortOrder"
`;

export const APPEARANCE_COLS = `
  id,
  entry_id AS "entryId",
  chapter,
  text,
  flag,
  flag_text AS "flagText",
  sort_order AS "sortOrder",
  book_id AS "bookId"
`;

export const OPEN_QUESTION_COLS = `
  id,
  entry_id AS "entryId",
  text,
  sort_order AS "sortOrder"
`;

// F9-B: category rows (replaces category_labels). deleted_at cast to double
// precision so a non-null soft-delete marker returns a JS number (mirrors the
// getDeletedEntries cast rationale — bigint otherwise arrives as a string).
export const CATEGORY_COLS = `
  id,
  label,
  shelf,
  sort_order AS "sortOrder",
  is_builtin AS "isBuiltin",
  deleted_at::double precision AS "deletedAt"
`;

// ---- Entry reads ----------------------------------------------------------

export async function getAllEntries(): Promise<EntryRow[]> {
  // F6 read-filter (behavior lock): soft-deleted entries (deleted_at set) vanish
  // from every live surface — shelves, the wiki snapshot, AND the AI gazetteer
  // built from this snapshot, so a deleted entry can never leak into AI grounding.
  return rows<EntryRow>(
    `SELECT ${ENTRY_COLS} FROM entries WHERE deleted_at IS NULL AND kind <> 'plotline' ORDER BY shelf, sort_order, name`,
  );
}

/**
 * Entries VISIBLE in one world — the same membership scope /wiki shows
 * (`loadWorldSnapshot` joins `world_entities` on `we.world_id`). Unlike
 * getAllEntries (every universe), this is bounded to `worldId` so a
 * world-scoped surface (the wiki-target picker) never offers an entry from a
 * sibling world. Soft-deleted rows are filtered, matching every live read.
 */
export async function getWorldEntries(worldId: string): Promise<EntryRow[]> {
  return rows<EntryRow>(
    `SELECT ${ENTRY_COLS} FROM entries e
       JOIN world_entities we ON we.entity_id = e.id AND we.world_id = $1
      WHERE e.deleted_at IS NULL AND e.kind <> 'plotline'
      ORDER BY e.shelf, e.sort_order, e.name`,
    [worldId],
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

// ---- Categories (F9-B) ----------------------------------------------------

/**
 * Every LIVE category (deleted_at IS NULL), in header order (sort_order, id).
 * Replaces the fixed Kind enum + category_labels reads: the 4 built-ins plus any
 * user-created categories. Soft-deleted categories are excluded (mirrors the
 * entries read-filter) so a deleted category vanishes from every live surface.
 * Excludes the 'plots' shelf: a plotline is a /plot-only category outside the
 * wiki four-shelf model (people|places|orders|lore); every consumer here is a
 * wiki-family surface (wiki snapshot, research + write pages, entry category
 * picker) that must not show a plot shelf or offer 'plotline' as an entry kind.
 * /plot reads plotlines straight from entries (kind='plotline'), never via this
 * function, so the filter contains the plot category without touching a
 * wiki/research/write surface.
 */
export async function getCategories(): Promise<CategoryRow[]> {
  return rows<CategoryRow>(
    `SELECT ${CATEGORY_COLS} FROM categories
      WHERE deleted_at IS NULL AND shelf <> 'plots'
      ORDER BY sort_order, id`,
  );
}

