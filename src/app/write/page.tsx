import Write from '@/features/write/Write';
import { getChapter, listChapters } from "@/server/db/chapters/queries";
import { getCategories, getWorldEntries } from "@/server/db/gazetteer/reads";
import { getWorldTree } from "@/server/db/structure/queries";
import { resolveActiveScope } from '@/domain/scope/activeScope';
import { paragraphsToDoc } from '@/domain/write/adapters';
import { loadChapterMarks } from '@/domain/write/chapterMarks';
import { dbChapterMarksReader } from '@/server/write/chapterMarksReader';
import { aiEnabled } from '@/server/ai/saarouters';

export const dynamic = 'force-dynamic';

const EMPTY_BODY = paragraphsToDoc(['']);

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ chapter?: string; u?: string; w?: string; book?: string }>;
}) {
  const { chapter: chapterParam, u: uParam, w: wParam, book: bookParam } = await searchParams;

  const tree = await getWorldTree();
  const scope = resolveActiveScope(tree, { u: uParam, w: wParam, book: bookParam });

  const chapters = await listChapters(scope.bookId);
  const lastNumber = chapters.length > 0 ? chapters[chapters.length - 1]!.number : 1;
  const requested = chapterParam ? Number(chapterParam) : NaN;
  const chapterNumber =
    chapters.some((c) => c.number === requested) ? requested : lastNumber;

  const chapter = await getChapter(chapterNumber, scope.bookId);
  const body = chapter?.body ?? EMPTY_BODY;
  const title = chapter?.title ?? 'Low Water';

  const [pickerEntries, pickerCategories] = await Promise.all([
    getWorldEntries(scope.worldId),
    getCategories(),
  ]);

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
    <Write
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
