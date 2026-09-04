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
import {
  getChapter,
  getCategories,
  getWorldEntries,
  getWorldTree,
  listChapters,
} from '@/lib/db/queries';
import { resolveActiveScope } from '@/lib/scope/activeScope';
import { paragraphsToDoc } from '@/lib/write/adapters';
import { loadChapterMarks } from '@/lib/write/chapterMarks';
import { dbChapterMarksReader } from '@/lib/write/chapterMarksReader';
import { aiEnabled } from '@/lib/ai/saarouters';

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

  // The active scope, resolved by the ONE resolver every surface and pill uses,
  // so the header and the chapter list never disagree on which book is active.
  // listChapters is SCOPED to that book, so the left index shows exactly the
  // active book's chapters (not all 42 across six books).
  const tree = await getWorldTree();
  const scope = resolveActiveScope(tree, { u: uParam, w: wParam, book: bookParam });

  const chapters = await listChapters(scope.bookId);
  // Default to the last chapter (the working edge); an unknown/absent param also
  // falls back to it so a stale URL never lands on nothing.
  const lastNumber = chapters.length > 0 ? chapters[chapters.length - 1]!.number : 1;
  const requested = chapterParam ? Number(chapterParam) : NaN;
  const chapterNumber =
    chapters.some((c) => c.number === requested) ? requested : lastNumber;

  const chapter = await getChapter(chapterNumber, scope.bookId);
  const body = chapter?.body ?? EMPTY_BODY;
  const title = chapter?.title ?? 'Low Water';

  // Wiki-target picker (T-WRITE-WIKI-MODAL slice A): the "Add to the wiki"
  // modal on an open mark needs the live entry list (world-scoped, same
  // membership /wiki + /research show) and the category pills. getWorldEntries
  // is soft-delete-filtered and bounded to the active world, so the modal never
  // offers a sibling world's entry.
  const [pickerEntries, pickerCategories] = await Promise.all([
    getWorldEntries(scope.worldId),
    getCategories(),
  ]);

  // Every mark this screen renders — the open chapter's deterministic run, its
  // fresh cached AI marks, and each sibling chapter's left-index dot — resolved
  // together against one wiki snapshot and one freshness gate, so a dot and the
  // rail it opens onto can never disagree.
  const marks = await loadChapterMarks(
    {
      universeId: scope.universeId,
      bookId: scope.bookId,
      chapterNumber,
      body,
    },
    dbChapterMarksReader,
  );

  return (
    <Manuscript
      key={chapterNumber}
      chapterNumber={chapterNumber}
      chapterTitle={title}
      initialBody={body}
      initialMarks={marks.marks}
      wiki={marks.wiki}
      resolvedMarkKeys={marks.resolvedMarkKeys}
      chapterCounts={marks.chapterCounts}
      chapters={chapters.map((c) => ({
        number: c.number,
        title: c.title,
        severity: marks.severityByNumber.get(c.number) ?? null,
      }))}
      aiEnabled={aiEnabled()}
      activeBookId={scope.bookId}
      activeUniverseId={scope.universeId}
      activeWorldId={scope.worldId}
      pickerEntries={pickerEntries.map((e) => ({ id: e.id, name: e.name, kind: e.kind }))}
      pickerCategories={pickerCategories.map((c) => ({ id: c.id, label: c.label }))}
      initialAiMarks={marks.aiMarks}
    />
  );
}
