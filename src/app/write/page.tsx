// =============================================================================
// Write screen — server component (HANDOFF §6/§7/§8).
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
import {
  getChapter,
  getPhraseChapterCounts,
  getResolvedMarkKeys,
  listChapters,
  loadWikiSnapshot,
} from '@/lib/db/queries';
import { buildCheckInput, paragraphsToDoc, toCheckWiki } from '@/lib/write/adapters';
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

  const [chapter, wiki, resolvedMarkKeys, chapterCounts] = await Promise.all([
    getChapter(chapterNumber),
    loadWikiSnapshot(),
    getResolvedMarkKeys(),
    getPhraseChapterCounts(),
  ]);

  const body = chapter?.body ?? EMPTY_BODY;
  const title = chapter?.title ?? 'Low Water';

  // Run the engine at load over the real manuscript + wiki (not fixtures).
  const { marks } = checkManuscript(
    buildCheckInput({ body, db: wiki, resolvedMarkKeys, chapterCounts }),
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
      chapters={chapters.map((c) => ({ number: c.number, title: c.title }))}
      aiEnabled={aiEnabled()}
    />
  );
}
