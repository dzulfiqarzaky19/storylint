// =============================================================================
// Write screen — server component.
//
// Runs the SAME pure engine at load that the client re-runs on every keystroke,
// so the proof is marked from first paint. `force-dynamic` because the page
// reads live DB state (chapter body, wiki snapshot, resolved marks) each request.
//
// The engine runs LIVE over the manuscript text + wiki snapshot — never a
// fixture. Suggestions are computed with the real chapter `source` so the Wiki
// poster and the Write rail agree on where a mark came from.
//
// Track C: the chapter is selected by the URL (?chapter=<n>), defaulting to the
// LAST chapter (the writer's working edge). A left index lists every chapter.
// =============================================================================

import { Manuscript } from '@/components/write/Manuscript';
import { checkManuscript } from '@/lib/check';
import type { Mark } from '@/lib/check';
import { chapterSeverity, buildSeverityByNumber } from '@/lib/check/severity';
import { resolveChapterMarks } from '@/lib/check/resolve';
import type { ChapterCheckCacheRow } from '@/lib/domain/types';
import {
  getChapter,
  getChapterCheckCache,
  getChaptersForBook,
  getPhraseChapterCounts,
  getCategories,
  getResolvedMarkKeys,
  getWorldEntries,
  getWorldTree,
  listChapters,
  loadWikiSnapshot,
} from '@/lib/db/queries';
import { resolveWriteScope } from './scope';
import { buildCheckInput, docToParagraphs, paragraphsToDoc, toCheckWiki } from '@/lib/write/adapters';
import { extractCandidatePhrases } from '@/lib/check/unrecorded';
import { aiEnabled } from '@/lib/ai/saarouters';
import { hashValue } from '@/lib/check/hash';

export const dynamic = 'force-dynamic';

// Fallback body if the chapter row is missing (e.g. an un-seeded DB), so the
// screen still renders rather than 500-ing.
const EMPTY_BODY = paragraphsToDoc(['']);

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ chapter?: string; u?: string; w?: string; book?: string }>;
}) {
  const { chapter: chapterParam, u: uParam, w: wParam, book: bookParam } = await searchParams;

  // T-SCOPE-2: resolve the active WORLD + BOOK from the URL with the SAME pure
  // resolver the BookPill uses, so the header and the chapter list never disagree
  // on which book is active. listChapters is now SCOPED to that book, so the left
  // index shows exactly the active book's chapters (not all 42 across six books).
  const tree = await getWorldTree();
  const { activeUniverseId, activeWorldId, activeBookId } = resolveWriteScope(tree, uParam, wParam, bookParam);

  const chapters = await listChapters(activeBookId);
  // Default to the last chapter (the working edge); an unknown/absent param also
  // falls back to it so a stale URL never lands on nothing.
  const lastNumber = chapters.length > 0 ? chapters[chapters.length - 1]!.number : 1;
  const requested = chapterParam ? Number(chapterParam) : NaN;
  const chapterNumber =
    chapters.some((c) => c.number === requested) ? requested : lastNumber;

  const [chapter, wiki, resolvedMarkKeys] = await Promise.all([
    getChapter(chapterNumber, activeBookId),
    loadWikiSnapshot(activeUniverseId, activeBookId),
    getResolvedMarkKeys(),
  ]);

  const body = chapter?.body ?? EMPTY_BODY;
  const title = chapter?.title ?? 'Low Water';

  // Wiki-target picker (T-WRITE-WIKI-MODAL slice A): the "Add to the wiki"
  // modal on an open mark needs the live entry list (world-scoped, same
  // membership /wiki + /research show) and the category pills. getWorldEntries
  // is soft-delete-filtered and bounded to the active world, so the modal never
  // offers a sibling world's entry.
  const [pickerEntries, pickerCategories] = await Promise.all([
    getWorldEntries(activeWorldId),
    getCategories(),
  ]);

  // Tier 2 recurrence ranking: fetch DISTINCT-chapter counts ONLY for the
  // phrases actually on THIS chapter (extractCandidatePhrases keys are the same
  // canonical phraseIndexKey form the engine looks up), instead of serializing
  // the entire book-wide index to the client every load. The count itself stays
  // book-wide (a phrase in ch3 + ch7 still reports 2). Depends on body, so it
  // runs after the load above rather than inside that Promise.all.
  const chapterCounts = await getPhraseChapterCounts([
    ...extractCandidatePhrases(docToParagraphs(body)).keys(),
  ]);

  // Run the engine at load over the real manuscript + wiki (not fixtures).
  const { marks } = checkManuscript(
    buildCheckInput({ body, db: wiki, resolvedMarkKeys, chapterCounts }),
  );

  // Feature 1: left-index severity dots. Each chapter's dot must reflect the
  // SAME mark set the writer sees in the rail on open, or the index lies ("a dot,
  // but nothing to check" - the bug this ticket fixes). So the dot derives from
  // resolveChapterMarks, the ONE resolver the active rail also reads (regex plus
  // that chapter's fresh AI-cache marks). The ACTIVE chapter is still forced to
  // null (buildSeverityByNumber) so its redundant dot never shows.
  const bookChapters = await getChaptersForBook(activeBookId);

  // Per-chapter AI-cache rows for the resolver's freshness gate. Fetched only
  // when AI is on (else every resolve is a pure-regex fallback and the rows would
  // go unused). One bounded query per chapter in the active book, run in
  // parallel; reuses the existing getChapterCheckCache, no new DB function.
  const aiOn = aiEnabled();
  const cacheRowByNumber = new Map<number, ChapterCheckCacheRow | null>();
  if (aiOn) {
    await Promise.all(
      bookChapters.map(async (c) => {
        cacheRowByNumber.set(c.number, await getChapterCheckCache(c.id));
      }),
    );
  }
  const severityByNumber = buildSeverityByNumber(
    bookChapters,
    chapterNumber,
    (chapterBody, chapterNum) =>
      chapterSeverity(
        resolveChapterMarks({
          body: chapterBody,
          db: wiki,
          resolvedMarkKeys,
          aiEnabled: aiOn,
          cacheRow: cacheRowByNumber.get(chapterNum) ?? null,
        }),
      ),
  );

  // T-AICACHE: rehydrate the last AI cross-check from cache when it is still
  // FRESH. The cached row is valid only while BOTH the body it was checked
  // against and the wiki snapshot the AI grounded in are unchanged (hash match).
  // On a hit we pass the stored AI marks so the rail shows them from first paint
  // with NO gateway call; on a miss/stale row the client re-runs the AI as before.
  let initialAiMarks: Mark[] = [];
  if (aiEnabled() && chapter) {
    const cache = await getChapterCheckCache(chapter.id);
    if (
      cache &&
      cache.bodyHash === hashValue(body) &&
      cache.wikiHash === hashValue(wiki)
    ) {
      initialAiMarks = cache.marks as Mark[];
    }
  }

  return (
    <Manuscript
      key={chapterNumber}
      chapterNumber={chapterNumber}
      chapterTitle={title}
      initialBody={body}
      initialMarks={marks}
      wiki={toCheckWiki(wiki)}
      resolvedMarkKeys={resolvedMarkKeys}
      chapterCounts={[...chapterCounts]}
      chapters={chapters.map((c) => ({
        number: c.number,
        title: c.title,
        severity: severityByNumber.get(c.number) ?? null,
      }))}
      aiEnabled={aiEnabled()}
      activeBookId={activeBookId}
      activeUniverseId={activeUniverseId}
      activeWorldId={activeWorldId}
      pickerEntries={pickerEntries.map((e) => ({ id: e.id, name: e.name, kind: e.kind }))}
      pickerCategories={pickerCategories.map((c) => ({ id: c.id, label: c.label }))}
      initialAiMarks={initialAiMarks}
    />
  );
}
