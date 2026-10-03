import { describe, expect, it } from 'vitest';

import { tiptapDocToMarkdown } from './tiptapMarkdown';

type Node = { type: string; text?: string; content?: Node[]; marks?: { type: string }[]; attrs?: { level?: number } };

const text = (value: string, ...marks: string[]): Node => ({
  type: 'text',
  text: value,
  marks: marks.map((type) => ({ type })),
});
const paragraph = (...content: Node[]): Node => ({ type: 'paragraph', content });
const listItem = (value: string): Node => ({ type: 'listItem', content: [paragraph(text(value))] });
const doc = (...content: Node[]) => ({ type: 'doc', content });

describe('tiptapDocToMarkdown', () => {
  it.each([[null], [undefined], ['text'], [{ type: 'doc' }]])('returns an empty string for %j', (value) => {
    expect(tiptapDocToMarkdown(value)).toBe('');
  });

  it('separates blocks with a blank line', () => {
    expect(tiptapDocToMarkdown(doc(paragraph(text('One.')), paragraph(text('Two.'))))).toBe('One.\n\nTwo.');
  });

  it.each([
    ['bold', '**word**'],
    ['italic', '*word*'],
    ['code', '`word`'],
    ['strike', '~~word~~'],
    ['underline', 'word'],
  ])('writes a %s mark as %s', (mark, expected) => {
    expect(tiptapDocToMarkdown(doc(paragraph(text('word', mark))))).toBe(expected);
  });

  it('nests marks in the order they are listed', () => {
    expect(tiptapDocToMarkdown(doc(paragraph(text('word', 'bold', 'italic'))))).toBe('***word***');
  });

  it('keeps unmarked text around a marked run', () => {
    const block = paragraph(text('a '), text('bold', 'bold'), text(' z'));

    expect(tiptapDocToMarkdown(doc(block))).toBe('a **bold** z');
  });

  it('keeps the text inside an inline node it does not know', () => {
    const block = paragraph(text('see '), { type: 'mention', content: [text('Maren')] });

    expect(tiptapDocToMarkdown(doc(block))).toBe('see Maren');
  });

  it('writes a hard break as two spaces and a newline', () => {
    const block = paragraph(text('one'), { type: 'hardBreak' }, text('two'));

    expect(tiptapDocToMarkdown(doc(block))).toBe('one  \ntwo');
  });

  it.each([
    [1, '# Title'],
    [3, '### Title'],
  ])('writes a level %i heading as "%s"', (level, expected) => {
    const heading: Node = { type: 'heading', attrs: { level }, content: [text('Title')] };

    expect(tiptapDocToMarkdown(doc(heading))).toBe(expected);
  });

  it('treats a heading with no level as level 1', () => {
    expect(tiptapDocToMarkdown(doc({ type: 'heading', content: [text('Title')] }))).toBe('# Title');
  });

  it('writes a bullet list', () => {
    const list: Node = { type: 'bulletList', content: [listItem('one'), listItem('two')] };

    expect(tiptapDocToMarkdown(doc(list))).toBe('- one\n- two');
  });

  it('numbers an ordered list from 1', () => {
    const list: Node = { type: 'orderedList', content: [listItem('one'), listItem('two')] };

    expect(tiptapDocToMarkdown(doc(list))).toBe('1. one\n2. two');
  });

  it('prefixes every line of a blockquote', () => {
    const quote: Node = { type: 'blockquote', content: [paragraph(text('one')), paragraph(text('two'))] };

    expect(tiptapDocToMarkdown(doc(quote))).toBe('> one\n> \n> two');
  });

  it('fences a code block', () => {
    const code: Node = { type: 'codeBlock', content: [text('let x = 1;')] };

    expect(tiptapDocToMarkdown(doc(code))).toBe('```\nlet x = 1;\n```');
  });

  it('writes a horizontal rule', () => {
    expect(tiptapDocToMarkdown(doc({ type: 'horizontalRule' }))).toBe('---');
  });

  it('keeps the text of a block type it does not know', () => {
    const unknown: Node = { type: 'callout', content: [paragraph(text('inside'))] };

    expect(tiptapDocToMarkdown(doc(unknown))).toBe('inside');
  });
});
