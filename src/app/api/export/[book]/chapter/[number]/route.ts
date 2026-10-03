import { getChapter } from "@/server/db/chapters/queries";
import { chapterToMarkdown, slugifyTitle } from '@/domain/export/exportMarkdown';

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
