import { rows, one } from "@/server/db/pool";
import { epochMs } from "@/server/db/sql";
import type { ChapterRow, ChapterCheckCacheRow } from "@/domain/types";

export async function getChapter(
  number: number,
  bookId: string,
): Promise<ChapterRow | null> {
  return one<ChapterRow>(
    `SELECT id, number, title, body FROM chapters WHERE number = $1 AND book_id = $2`,
    [number, bookId],
  );
}

export async function listChapters(
  bookId: string,
): Promise<{ id: string; number: number; title: string }[]> {
  return rows<{ id: string; number: number; title: string }>(
    `SELECT id, number, title FROM chapters WHERE book_id = $1 ORDER BY number`,
    [bookId],
  );
}

export async function getResolvedMarkKeys(bookId: string): Promise<string[]> {
  const res = await rows<{ markKey: string }>(
    `SELECT mark_key AS "markKey" FROM resolved_marks WHERE book_id = $1`,
    [bookId],
  );
  return res.map((r) => r.markKey);
}

export async function getDismissedSuggestionKeys(worldId: string): Promise<string[]> {
  const res = await rows<{ suggestionKey: string }>(
    `SELECT suggestion_key AS "suggestionKey" FROM dismissed_suggestions WHERE world_id = $1`,
    [worldId],
  );
  return res.map((r) => r.suggestionKey);
}

export async function getPhraseChapterCounts(
  bookId: string,
  phrases: readonly string[],
): Promise<Map<string, number>> {
  if (phrases.length === 0) return new Map();
  const res = await rows<{ phrase: string; chapters: number }>(
    `SELECT pm.phrase, COUNT(*)::int AS chapters
       FROM phrase_mentions pm
       JOIN chapters c ON c.id = pm.chapter_id
      WHERE c.book_id = $1 AND pm.phrase = ANY($2)
      GROUP BY pm.phrase`,
    [bookId, phrases as string[]],
  );
  return new Map(res.map((r) => [r.phrase, r.chapters]));
}

export async function getChaptersForBook(bookId: string): Promise<ChapterRow[]> {
  return rows<ChapterRow>(
    `SELECT id, number, title, body FROM chapters WHERE book_id = $1 ORDER BY number`,
    [bookId],
  );
}

export async function getChapterCheckCache(
  chapterId: string,
): Promise<ChapterCheckCacheRow | null> {
  return one<ChapterCheckCacheRow>(
    `SELECT chapter_id AS "chapterId",
            body_hash  AS "bodyHash",
            wiki_hash  AS "wikiHash",
            marks,
            ${epochMs("checked_at")} AS "checkedAt"
       FROM chapter_check_cache
      WHERE chapter_id = $1`,
    [chapterId],
  );
}
