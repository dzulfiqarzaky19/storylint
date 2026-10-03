import { aiEnabled } from "@/server/ai/saarouters";
import { getChapterCheckCache, getChaptersForBook, getPhraseChapterCounts, getResolvedMarkKeys } from "@/server/db/chapters/queries";
import { loadWikiSnapshot } from "@/server/db/gazetteer/snapshots";
import type { ChapterMarksReader } from "@/domain/write/chapterMarks";

export const dbChapterMarksReader: ChapterMarksReader = {
  wikiSnapshot: (universeId) => loadWikiSnapshot(universeId),
  resolvedMarkKeys: (bookId) => getResolvedMarkKeys(bookId),
  bookChapters: async (bookId) => {
    const chapters = await getChaptersForBook(bookId);
    return chapters.map((c) => ({ id: c.id, number: c.number, body: c.body }));
  },
  phraseChapterCounts: (bookId, phrases) => getPhraseChapterCounts(bookId, phrases),
  checkCache: (chapterId) => getChapterCheckCache(chapterId),
  aiEnabled: () => aiEnabled(),
};
