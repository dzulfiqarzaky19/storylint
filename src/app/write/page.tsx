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
import { chapterSeverity, buildSeverityByNumber } from '@/lib/check/severity';
import {
  getAllChaptersWithBody,
  getChapter,
  getPhraseChapterCounts,
  getResolvedMarkKeys,
  listChapters,
  loadWikiSnapshot,
} from '@/lib/db/queries';
import { buildCheckInput, docToParagraphs, paragraphsToDoc, toCheckWiki } from '@/lib/write/adapters';
import { extractCandidatePhrases } from '@/lib/check/unrecorded';
import { aiEnabled } from '@/lib/ai/saarouters';

export const dynamic = 'force-dynamic';

// Fallback body if the chapter row is missing (e.g. an un-seeded DB), so the
// screen still renders rather than 500-ing.
const EMPTY_BODY = paragraphsToDoc(['']);

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ chapter?: string }>;
}) {
  const { chapter: chapterParam } = await searchParams;

  const chapters = await listChapters();
  // Default to the last chapter (the working edge); an unknown/absent param also
  // falls back to it so a stale URL never lands on nothing.
  const lastNumber = chapters.length > 0 ? chapters[chapters.length - 1]!.number : 1;
  const requested = chapterParam ? Number(chapterParam) : NaN;
  const chapterNumber =
    chapters.some((c) => c.number === requested) ? requested : lastNumber;

  const [chapter, wiki, resolvedMarkKeys] = await Promise.all([
    getChapter(chapterNumber),
    loadWikiSnapshot(),
    getResolvedMarkKeys(),
  ]);

  const body = chapter?.body ?? EMPTY_BODY;
  const title = chapter?.title ?? 'Low Water';

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

  // Feature 1 — left-index severity dots. Re-run the (pure, in-memory) engine
  // over EVERY chapter's body, reusing the single wiki snapshot + book-wide
  // resolvedMarkKeys already loaded above (no per-chapter DB round trips).
  // chapterCounts is ranking-only and never gates mark existence, so it is
  // omitted here. The ACTIVE chapter is forced to null: the writer already sees
  // its marks in the right rail, so a dot on it would be redundant noise.
  const allChapters = await getAllChaptersWithBody();
  const severityByNumber = buildSeverityByNumber(
    allChapters,
    chapterNumber,
    (chapterBody) =>
      chapterSeverity(
        checkManuscript(
          buildCheckInput({ body: chapterBody, db: wiki, resolvedMarkKeys }),
        ).marks,
      ),
  );

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
    />
  );
}
