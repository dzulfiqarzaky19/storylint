import { describe, expect, it } from 'vitest';

import type { ChapterRow } from '@/domain/types';
import { paragraphsToDoc } from '@/domain/write/adapters';
import { chapterToMarkdown, novelToMarkdown, slugifyTitle } from './exportMarkdown';

const chapter = (number: number, title: string, ...paragraphs: string[]): ChapterRow => ({
  id: `ch${number}`,
  number,
  title,
  body: paragraphsToDoc(paragraphs),
});

describe('slugifyTitle', () => {
  it.each([
    ['lowercases and hyphenates', 'The Perfect Run', 'the-perfect-run'],
    ['collapses runs of punctuation into one hyphen', 'Lord — of the  Mysteries!', 'lord-of-the-mysteries'],
    ['trims leading and trailing hyphens', '  ¡Hola!  ', 'hola'],
    ['keeps digits', 'Book 2', 'book-2'],
    ['falls back to "book" for a title with nothing usable', '???', 'book'],
    ['falls back to "book" for an empty title', '', 'book'],
  ])('%s', (_name, title, expected) => {
    expect(slugifyTitle(title)).toBe(expected);
  });
});

describe('chapterToMarkdown', () => {
  it('writes the chapter as a top-level heading followed by its body', () => {
    expect(chapterToMarkdown(chapter(3, 'The Light', 'One.', 'Two.'))).toBe('# 3. The Light\n\nOne.\n\nTwo.');
  });

  it('writes only the heading for a chapter with no body', () => {
    expect(chapterToMarkdown({ id: 'ch1', number: 1, title: 'Empty', body: null })).toBe('# 1. Empty');
  });
});

describe('novelToMarkdown', () => {
  it('writes only the title for a book with no chapters', () => {
    expect(novelToMarkdown({ title: 'Verge' }, [])).toBe('# Verge\n');
  });

  it('writes chapters in number order under second-level headings, divided by rules', () => {
    const markdown = novelToMarkdown({ title: 'Verge' }, [chapter(2, 'Second', 'B.'), chapter(1, 'First', 'A.')]);

    expect(markdown).toBe('# Verge\n\n## 1. First\n\nA.\n\n---\n\n## 2. Second\n\nB.');
  });

  it('does not reorder the caller’s chapter list', () => {
    const chapters = [chapter(2, 'Second'), chapter(1, 'First')];

    novelToMarkdown({ title: 'Verge' }, chapters);

    expect(chapters.map((c) => c.number)).toEqual([2, 1]);
  });
});
