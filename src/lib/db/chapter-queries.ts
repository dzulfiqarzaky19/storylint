// /write chapter READ layer. SQL for chapters, phrase_mentions,
// chapter_check_cache, resolved_marks, dismissed_suggestions. A wiki edit
// in queries.ts cannot break the Write rail.
import { rows, one } from "./pool";
import { DEFAULT_BOOK_ID } from "./scope";
import type { ChapterRow, ChapterCheckCacheRow } from "../domain/types";

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
export async function listChapters(
  bookId: string = DEFAULT_BOOK_ID,
): Promise<{ id: string; number: number; title: string }[]> {
  // T-SCOPE-2: chapter number is unique only WITHIN a book (UNIQUE(book_id,
  // number)), so an unfiltered list collides every book's Chapter 1..7 into one
  // 42-row index (six "CHAPTER ONE"). The Write left index shows exactly the
  // ACTIVE book's chapters; the caller passes the resolved active book id.
  return rows<{ id: string; number: number; title: string }>(
    `SELECT id, number, title FROM chapters WHERE book_id = $1 ORDER BY number`,
    [bookId],
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

// ---- F8 markdown export (Track F8) ---------------------------------------

/**
 * One book's chapters WITH body (ProseMirror JSON), ordered by number, SCOPED to
 * a single book (R3 "whole novel" = one book). Distinct from
 * getAllChaptersWithBody() (which is un-scoped and feeds the Write severity pass)
 * so that gate-locked caller is untouched.
 */
export async function getChaptersForBook(bookId: string): Promise<ChapterRow[]> {
  return rows<ChapterRow>(
    `SELECT id, number, title, body FROM chapters WHERE book_id = $1 ORDER BY number`,
    [bookId],
  );
}

// ---- Chapter AI-check cache (T-AICACHE) -----------------------------------

/**
 * The persisted AI cross-check result for a chapter, or null when none is cached.
 * The caller compares bodyHash/wikiHash against the chapter's current body and
 * wiki snapshot to decide whether the cached marks are still fresh (rehydrate the
 * rail) or stale (re-run the AI). Reads only; never mutates.
 */
export async function getChapterCheckCache(
  chapterId: string,
): Promise<ChapterCheckCacheRow | null> {
  return one<ChapterCheckCacheRow>(
    `SELECT chapter_id AS "chapterId",
            body_hash  AS "bodyHash",
            wiki_hash  AS "wikiHash",
            marks,
            checked_at AS "checkedAt"
       FROM chapter_check_cache
      WHERE chapter_id = $1`,
    [chapterId],
  );
}

