// /write chapter WRITE layer (mirrors ./chapter-queries.ts).
// Chapter / phrase-index / resolved-mark / dismissed-suggestion / check-cache
// mutations. Book-birth INSERTs and cascade DELETEs stay in mutations.ts.
import { query, one, withTransaction } from "./pool";
import { DEFAULT_BOOK_ID } from "./scope";
import type { ResolvedMarkRow, ChapterCheckCacheRow } from "../domain/types";

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
