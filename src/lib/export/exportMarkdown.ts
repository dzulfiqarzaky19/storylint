/**
 * F8-S2 — chapter & novel Markdown assemblers.
 *
 * Pure functions that compose the S1 body serializer (`tiptapDocToMarkdown`)
 * into whole-document Markdown:
 *
 *  - `chapterToMarkdown(ch)` renders one chapter standalone: an H1 numbered
 *    title (`# {number}. {title}`), then the serialized body below it.
 *  - `novelToMarkdown(book, chapters)` renders a whole book: an H1 book title,
 *    then every chapter as an H2 numbered heading (`## {number}. {title}`) with
 *    its body, chapters ordered by `number` ascending (stable for ties), joined
 *    by a `\n\n---\n\n` horizontal rule with NO leading/trailing rule. A book
 *    with zero chapters renders just `# {title}\n` (R5).
 *
 * No I/O: callers fetch the book row and its `ChapterRow[]` (F8-S3) and hand
 * them in. Ordering is applied here defensively even though the query already
 * orders by number, so the function is correct for any caller.
 */
import type { ChapterRow } from '@/lib/domain/types';
import { tiptapDocToMarkdown } from '@/lib/export/tiptapMarkdown';

/** Minimal view of a book: only the title is needed for export. */
export interface ExportBook {
  title: string;
}

/** `# {number}. {title}` then the serialized body (omitted when body is empty). */
export function chapterToMarkdown(ch: ChapterRow): string {
  const heading = `# ${ch.number}. ${ch.title}`;
  const bodyMd = tiptapDocToMarkdown(ch.body);
  return bodyMd ? `${heading}\n\n${bodyMd}` : heading;
}

/** `## {number}. {title}` then the serialized body (omitted when body is empty). */
function chapterSection(ch: ChapterRow): string {
  const heading = `## ${ch.number}. ${ch.title}`;
  const bodyMd = tiptapDocToMarkdown(ch.body);
  return bodyMd ? `${heading}\n\n${bodyMd}` : heading;
}

export function novelToMarkdown(book: ExportBook, chapters: ChapterRow[]): string {
  const title = `# ${book.title}`;
  if (chapters.length === 0) return `${title}\n`;
  const ordered = [...chapters].sort((a, b) => a.number - b.number);
  const sections = ordered.map(chapterSection).join('\n\n---\n\n');
  return `${title}\n\n${sections}`;
}
