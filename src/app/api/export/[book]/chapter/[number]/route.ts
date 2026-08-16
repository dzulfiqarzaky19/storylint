// Chapter Markdown export route (App Router, GET).
//
// GET /api/export/[book]/chapter/[number] streams ONE chapter as a Markdown
// document: getChapter(number, bookId) -> chapterToMarkdown(...), returned as
// `text/markdown; charset=utf-8` with a
// `Content-Disposition: attachment; filename="<book-slug>-chapter-<n>.md"` so
// the browser downloads it.
//
// Sibling of /api/export/[book] (whole book). The book param is the book id and
// number is the chapter number WITHIN that book (chapter numbers restart per
// book, so both are required). An unknown book OR a chapter absent from that
// book is a 404 — the only not-found paths.

import { getChapter } from '@/lib/db/queries';
import { chapterToMarkdown, slugifyTitle } from '@/lib/export/exportMarkdown';

// Always run on request: the export reflects live DB state each call.
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ book: string; number: string }> },
) {
  const { book: bookId, number: numberParam } = await params;

  const number = Number(numberParam);
  if (!Number.isInteger(number)) {
    return new Response(`Bad chapter number: ${numberParam}`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const chapter = await getChapter(number, bookId);
  if (!chapter) {
    return new Response(`No such chapter: ${bookId}/${numberParam}`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const markdown = chapterToMarkdown(chapter);
  const filename = `${slugifyTitle(chapter.title)}-chapter-${number}.md`;

  return new Response(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
