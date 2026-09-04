// =============================================================================
// The production adapter behind `ChapterMarksReader`.
//
// Split from `chapterMarks.ts` so that module imports no database and no
// gateway: the resolution — the freshness gate, the merge, the index-dot rules —
// is then exercisable against a fake reader with no Postgres and no network.
// Mirrors the seam `lib/websearch` already uses (`buildSearchImpl(cfg)` handed
// to `retrieve`). This is the only adapter production ever passes.
// =============================================================================

import { aiEnabled } from "@/lib/ai/saarouters";
import {
  getChapterCheckCache,
  getChaptersForBook,
  getPhraseChapterCounts,
  getResolvedMarkKeys,
  loadWikiSnapshot,
} from "@/lib/db/queries";
import type { ChapterMarksReader } from "./chapterMarks";

/** Reads a chapter's marks from the live database and the configured gateway. */
export const dbChapterMarksReader: ChapterMarksReader = {
  wikiSnapshot: (universeId, bookId) => loadWikiSnapshot(universeId, bookId),
  resolvedMarkKeys: () => getResolvedMarkKeys(),
  bookChapters: async (bookId) => {
    const chapters = await getChaptersForBook(bookId);
    return chapters.map((c) => ({ id: c.id, number: c.number, body: c.body }));
  },
  phraseChapterCounts: (phrases) => getPhraseChapterCounts(phrases),
  checkCache: (chapterId) => getChapterCheckCache(chapterId),
  aiEnabled: () => aiEnabled(),
};
