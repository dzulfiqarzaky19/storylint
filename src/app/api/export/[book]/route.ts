import { getBook } from "@/server/db/structure/queries";
import { getChaptersForBook } from "@/server/db/chapters/queries";
import { novelToMarkdown, slugifyTitle } from '@/domain/export/exportMarkdown';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ book: string }> },
) {
  const { book: bookId } = await params;

  const book = await getBook(bookId);
  if (!book) {
    return new Response(`No such book: ${bookId}`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const chapters = await getChaptersForBook(bookId);
  const markdown = novelToMarkdown(book, chapters);
  const filename = `${slugifyTitle(book.title)}.md`;

  return new Response(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
