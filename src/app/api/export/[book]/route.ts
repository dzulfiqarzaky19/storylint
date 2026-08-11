// F8-S3 — book Markdown export route (App Router, GET).
//
// GET /api/export/[book] streams the whole book as a single Markdown document:
//   getBook(bookId) + getChaptersForBook(bookId) -> novelToMarkdown(...)
// returned as `text/markdown; charset=utf-8` with a
// `Content-Disposition: attachment; filename="<slug>.md"` so the browser
// downloads it. R3: "whole novel" = one book's chapters ordered by number. R5: a
// 0-chapter book is a valid 200 whose body is just `# {title}\n`, not a 404.
//
// The book param is the book id (e.g. the seeded DEFAULT_BOOK_ID "book-1"). An
// unknown id (no such book) is a 404 — the only not-found path.

import { getBook, getChaptersForBook } from '@/lib/db/queries';
import { novelToMarkdown, slugifyTitle } from '@/lib/export/exportMarkdown';

// Always run on request: the export reflects live DB state each call.
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
