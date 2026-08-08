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
// =============================================================================

import { Manuscript } from '@/components/write/Manuscript';
import { checkManuscript } from '@/lib/check';
import {
  getChapter,
  getResolvedMarkKeys,
  loadWikiSnapshot,
} from '@/lib/db/queries';
import { buildCheckInput, paragraphsToDoc, toCheckWiki } from '@/lib/write/adapters';

export const dynamic = 'force-dynamic';

const CHAPTER_NUMBER = 7;

// Fallback body if the chapter row is missing (e.g. an un-seeded DB), so the
// screen still renders rather than 500-ing.
const EMPTY_BODY = paragraphsToDoc(['']);

export default async function WritePage() {
  const [chapter, wiki, resolvedMarkKeys] = await Promise.all([
    getChapter(CHAPTER_NUMBER),
    loadWikiSnapshot(),
    getResolvedMarkKeys(),
  ]);

  const body = chapter?.body ?? EMPTY_BODY;
  const title = chapter?.title ?? 'Low Water';

  // Run the engine at load over the real manuscript + wiki (not fixtures).
  const { marks } = checkManuscript(
    buildCheckInput({ body, db: wiki, resolvedMarkKeys }),
  );

  return (
    <Manuscript
      chapterNumber={CHAPTER_NUMBER}
      chapterTitle={title}
      initialBody={body}
      initialMarks={marks}
      wiki={toCheckWiki(wiki)}
      resolvedMarkKeys={resolvedMarkKeys}
    />
  );
}
