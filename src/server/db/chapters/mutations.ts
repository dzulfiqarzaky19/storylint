import { query, one, withTransaction } from "@/server/db/pool";
import { epochMs, fromEpochMs } from "@/server/db/sql";
import type { ResolvedMarkRow, ChapterCheckCacheRow } from "@/domain/types";

export async function saveChapterBody(input: {
  number: number;
  body: unknown;
  bookId: string;
}): Promise<void> {
  await query(
    `UPDATE chapters SET body = $2 WHERE number = $1 AND book_id = $3`,
    [input.number, JSON.stringify(input.body), input.bookId],
  );
}

export async function replacePhraseMentions(input: {
  bookId: string;
  chapterNumber: number;
  phrases: ReadonlyMap<string, number>;
}): Promise<void> {
  const phrases = [...input.phrases.keys()];
  const counts = [...input.phrases.values()];
  await withTransaction(async (client) => {
    const chapter = await client.query<{ id: string }>(
      `SELECT id FROM chapters WHERE book_id = $1 AND number = $2`,
      [input.bookId, input.chapterNumber],
    );
    const chapterId = chapter.rows[0]?.id;
    if (!chapterId) return;
    await client.query(`DELETE FROM phrase_mentions WHERE chapter_id = $1`, [chapterId]);
    if (phrases.length === 0) return;
    await client.query(
      `INSERT INTO phrase_mentions (chapter_id, phrase, count)
       SELECT $1, p, c
         FROM UNNEST($2::text[], $3::int[]) AS t(p, c)`,
      [chapterId, phrases, counts],
    );
  });
}

export async function getNextChapterNumber(bookId: string): Promise<number> {
  const res = await one<{ next: number }>(
    `SELECT COALESCE(MAX(number), 0) + 1 AS next FROM chapters WHERE book_id = $1`,
    [bookId],
  );
  return res?.next ?? 1;
}

export async function insertChapter(input: {
  id: string;
  number: number;
  title: string;
  body: unknown;
  bookId: string;
}): Promise<{ id: string; number: number; title: string }> {
  const res = await one<{ id: string; number: number; title: string }>(
    `INSERT INTO chapters (id, book_id, number, title, body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, number, title`,
    [input.id, input.bookId, input.number, input.title, JSON.stringify(input.body)],
  );
  return res!;
}

export async function renameChapter(input: {
  number: number;
  title: string;
  bookId: string;
}): Promise<void> {
  await query(
    `UPDATE chapters SET title = $2 WHERE number = $1 AND book_id = $3`,
    [input.number, input.title, input.bookId],
  );
}

export async function countChaptersInBook(bookId: string): Promise<number> {
  const res = await one<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM chapters WHERE book_id = $1`,
    [bookId],
  );
  return res?.n ?? 0;
}

export async function deleteChapter(input: {
  number: number;
  bookId: string;
}): Promise<{ deleted: number }> {
  const res = await query(
    `DELETE FROM chapters WHERE number = $1 AND book_id = $2`,
    [input.number, input.bookId],
  );
  return { deleted: res.rowCount ?? 0 };
}

export async function upsertResolvedMark(input: {
  bookId: string;
  markKey: string;
  resolution: string;
  resolvedAt: number;
}): Promise<ResolvedMarkRow> {
  const res = await one<ResolvedMarkRow>(
    `INSERT INTO resolved_marks (book_id, mark_key, resolution, resolved_at)
     VALUES ($1, $2, $3, ${fromEpochMs("$4")})
     ON CONFLICT (book_id, mark_key)
       DO UPDATE SET resolution = EXCLUDED.resolution, resolved_at = EXCLUDED.resolved_at
     RETURNING mark_key AS "markKey",
               resolution,
               ${epochMs("resolved_at")} AS "resolvedAt"`,
    [input.bookId, input.markKey, input.resolution, input.resolvedAt],
  );
  if (!res) throw new Error("upsertResolvedMark: no row returned");
  return res;
}

export async function insertDismissedSuggestion(input: {
  worldId: string;
  suggestionKey: string;
}): Promise<void> {
  await query(
    `INSERT INTO dismissed_suggestions (world_id, suggestion_key)
     VALUES ($1, $2)
     ON CONFLICT (world_id, suggestion_key) DO NOTHING`,
    [input.worldId, input.suggestionKey],
  );
}

export async function upsertChapterCheckCache(input: {
  chapterId: string;
  bodyHash: string;
  wikiHash: string;
  marks: unknown;
  checkedAt: number;
}): Promise<ChapterCheckCacheRow> {
  const res = await one<ChapterCheckCacheRow>(
    `INSERT INTO chapter_check_cache (chapter_id, body_hash, wiki_hash, marks, checked_at)
     VALUES ($1, $2, $3, $4, ${fromEpochMs("$5")})
     ON CONFLICT (chapter_id)
       DO UPDATE SET body_hash  = EXCLUDED.body_hash,
                     wiki_hash  = EXCLUDED.wiki_hash,
                     marks      = EXCLUDED.marks,
                     checked_at = EXCLUDED.checked_at
     RETURNING chapter_id AS "chapterId",
               body_hash  AS "bodyHash",
               wiki_hash  AS "wikiHash",
               marks,
               ${epochMs("checked_at")} AS "checkedAt"`,
    [input.chapterId, input.bodyHash, input.wikiHash, JSON.stringify(input.marks), input.checkedAt],
  );
  if (!res) throw new Error("upsertChapterCheckCache: no row returned");
  return res;
}
