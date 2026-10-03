import type { ChapterRow } from '@/domain/types';
import { tiptapDocToMarkdown } from '@/domain/export/tiptapMarkdown';

export interface ExportBook {
  title: string;
}

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'book';
}

export function chapterToMarkdown(ch: ChapterRow): string {
  const heading = `# ${ch.number}. ${ch.title}`;
  const bodyMd = tiptapDocToMarkdown(ch.body);
  return bodyMd ? `${heading}\n\n${bodyMd}` : heading;
}

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
