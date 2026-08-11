/**
 * Golden-per-branch spec for the F8-S2 chapter/novel assemblers.
 *
 * `chapterToMarkdown(ch)` renders ONE chapter standalone: an H1 numbered title
 * then a blank line then the S1-serialized body. `novelToMarkdown(book,
 * chapters)` renders a whole book: an H1 book title, then each chapter as an H2
 * numbered heading + its body, chapters ordered by `number` ascending, joined by
 * a `\n\n---\n\n` rule (no leading/trailing rule). A 0-chapter book renders just
 * `# {title}\n` (R5). Assemblers are pure and reuse the S1 serializer.
 *
 * Each `it` locks ONE assembler branch (heading format, ordering, separator,
 * empty-book, body reuse) to an exact Markdown string, so a regression in that
 * branch changes exactly one assertion.
 */

import { describe, it, expect } from 'vitest';
import { chapterToMarkdown, novelToMarkdown } from '@/lib/export/exportMarkdown';
import type { ChapterRow } from '@/lib/domain/types';

// --- helpers: build a ProseMirror body of simple paragraphs ---
function body(...paragraphs: string[]) {
  return {
    type: 'doc',
    content: paragraphs.map((t) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: t }],
    })),
  };
}
function chapter(number: number, title: string, ...paragraphs: string[]): ChapterRow {
  return { id: `c${number}`, number, title, body: body(...paragraphs) };
}

describe('chapterToMarkdown — single chapter', () => {
  it('renders `# {number}. {title}` then a blank line then the body', () => {
    const ch = chapter(3, 'The Descent', 'First line.', 'Second line.');
    expect(chapterToMarkdown(ch)).toBe(
      '# 3. The Descent\n\nFirst line.\n\nSecond line.',
    );
  });

  it('renders the numbered heading with an empty body as just the heading', () => {
    const ch: ChapterRow = { id: 'c1', number: 1, title: 'Prologue', body: { type: 'doc', content: [] } };
    expect(chapterToMarkdown(ch)).toBe('# 1. Prologue');
  });

  it('reuses the S1 serializer for the body (marks, not escaped)', () => {
    const ch: ChapterRow = {
      id: 'c2',
      number: 2,
      title: 'Marks',
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }],
          },
        ],
      },
    };
    expect(chapterToMarkdown(ch)).toBe('# 2. Marks\n\n**bold**');
  });
});

describe('novelToMarkdown — whole book', () => {
  const book = { title: 'Nightfall' };

  it('renders book H1, then each chapter as `## {number}. {title}` + body, joined by `\\n\\n---\\n\\n`', () => {
    const chapters = [chapter(1, 'Dawn', 'Sun rises.'), chapter(2, 'Dusk', 'Sun sets.')];
    expect(novelToMarkdown(book, chapters)).toBe(
      '# Nightfall\n\n## 1. Dawn\n\nSun rises.\n\n---\n\n## 2. Dusk\n\nSun sets.',
    );
  });

  it('orders chapters strictly by number ascending regardless of input order', () => {
    const chapters = [chapter(2, 'Dusk', 'Sun sets.'), chapter(1, 'Dawn', 'Sun rises.')];
    expect(novelToMarkdown(book, chapters)).toBe(
      '# Nightfall\n\n## 1. Dawn\n\nSun rises.\n\n---\n\n## 2. Dusk\n\nSun sets.',
    );
  });

  it('is stable for chapters sharing a number (keeps input order)', () => {
    const a: ChapterRow = { id: 'a', number: 1, title: 'A', body: body('a body') };
    const b: ChapterRow = { id: 'b', number: 1, title: 'B', body: body('b body') };
    expect(novelToMarkdown(book, [a, b])).toBe(
      '# Nightfall\n\n## 1. A\n\na body\n\n---\n\n## 1. B\n\nb body',
    );
  });

  it('uses NO leading or trailing separator (join, not append) for a single chapter', () => {
    const chapters = [chapter(1, 'Only', 'One para.')];
    expect(novelToMarkdown(book, chapters)).toBe('# Nightfall\n\n## 1. Only\n\nOne para.');
  });

  it('renders a 0-chapter book as just `# {title}\\n` (R5)', () => {
    expect(novelToMarkdown(book, [])).toBe('# Nightfall\n');
  });

  it('renders a chapter with an empty body as just its heading (no trailing blank)', () => {
    const empty: ChapterRow = { id: 'e', number: 1, title: 'Empty', body: { type: 'doc', content: [] } };
    const chapters = [empty, chapter(2, 'Full', 'Text.')];
    expect(novelToMarkdown(book, chapters)).toBe(
      '# Nightfall\n\n## 1. Empty\n\n---\n\n## 2. Full\n\nText.',
    );
  });
});
