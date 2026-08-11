/**
 * Golden-per-branch spec for the pure `tiptapDocToMarkdown` serializer (F8-S1).
 *
 * Each `it` locks ONE node-type or mark branch to an exact Markdown string, so a
 * regression in that branch changes exactly one assertion. The serializer is
 * pure (no I/O): input is a Tiptap v3 doc JSON, output is a Markdown string.
 *
 * Defensive by design: the stored bodies are "paragraphs only" today, but the
 * StarterKit node set (heading/lists/blockquote/codeBlock/hr/hardBreak) and the
 * StarterKit marks (bold/italic/code/strike) are all covered so a future rich
 * body serializes correctly. Unknown node types recurse into children and never
 * throw. Empty / malformed docs serialize to "".
 */

import { describe, it, expect } from 'vitest';
import { tiptapDocToMarkdown } from '@/lib/export/tiptapMarkdown';

// --- helpers (DAMP: each test builds its own doc, these are shape shortcuts) ---
function doc(...content: unknown[]) {
  return { type: 'doc', content };
}
function para(...children: unknown[]) {
  return { type: 'paragraph', content: children };
}
function text(t: string, marks?: { type: string }[]) {
  return marks ? { type: 'text', text: t, marks } : { type: 'text', text: t };
}

describe('tiptapDocToMarkdown — node branches', () => {
  it('serializes an empty doc (no content) to ""', () => {
    expect(tiptapDocToMarkdown({ type: 'doc' })).toBe('');
    expect(tiptapDocToMarkdown({ type: 'doc', content: [] })).toBe('');
  });

  it('serializes a null / non-object doc to "" without throwing', () => {
    expect(tiptapDocToMarkdown(null)).toBe('');
    expect(tiptapDocToMarkdown(undefined)).toBe('');
    expect(tiptapDocToMarkdown('nope')).toBe('');
  });

  it('serializes a single paragraph to its plain text', () => {
    expect(tiptapDocToMarkdown(doc(para(text('hello'))))).toBe('hello');
  });

  it('joins two paragraphs with a blank line between them', () => {
    expect(tiptapDocToMarkdown(doc(para(text('a')), para(text('b'))))).toBe('a\n\nb');
  });

  it('serializes an empty paragraph to an empty line', () => {
    expect(tiptapDocToMarkdown(doc(para(), para(text('b'))))).toBe('\n\nb');
  });

  it('serializes heading levels to the matching number of #', () => {
    expect(tiptapDocToMarkdown(doc({ type: 'heading', attrs: { level: 1 }, content: [text('T')] }))).toBe('# T');
    expect(tiptapDocToMarkdown(doc({ type: 'heading', attrs: { level: 2 }, content: [text('T')] }))).toBe('## T');
    expect(tiptapDocToMarkdown(doc({ type: 'heading', attrs: { level: 3 }, content: [text('T')] }))).toBe('### T');
  });

  it('defaults a heading with no level to level 1', () => {
    expect(tiptapDocToMarkdown(doc({ type: 'heading', content: [text('T')] }))).toBe('# T');
  });

  it('serializes a bulletList to "- " items', () => {
    const list = {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [para(text('one'))] },
        { type: 'listItem', content: [para(text('two'))] },
      ],
    };
    expect(tiptapDocToMarkdown(doc(list))).toBe('- one\n- two');
  });

  it('serializes an orderedList to "1. " numbered items', () => {
    const list = {
      type: 'orderedList',
      content: [
        { type: 'listItem', content: [para(text('one'))] },
        { type: 'listItem', content: [para(text('two'))] },
      ],
    };
    expect(tiptapDocToMarkdown(doc(list))).toBe('1. one\n2. two');
  });

  it('serializes a blockquote with a "> " prefix', () => {
    const bq = { type: 'blockquote', content: [para(text('quoted'))] };
    expect(tiptapDocToMarkdown(doc(bq))).toBe('> quoted');
  });

  it('serializes a codeBlock as a fenced block', () => {
    const cb = { type: 'codeBlock', content: [text('const x = 1;')] };
    expect(tiptapDocToMarkdown(doc(cb))).toBe('```\nconst x = 1;\n```');
  });

  it('serializes a horizontalRule to ---', () => {
    expect(tiptapDocToMarkdown(doc({ type: 'horizontalRule' }))).toBe('---');
  });

  it('serializes a hardBreak inside a paragraph to a two-space newline', () => {
    const p = para(text('line one'), { type: 'hardBreak' }, text('line two'));
    expect(tiptapDocToMarkdown(doc(p))).toBe('line one  \nline two');
  });

  it('recurses into an unknown node type instead of throwing', () => {
    const weird = { type: 'mysteryWrapper', content: [para(text('inner'))] };
    expect(tiptapDocToMarkdown(doc(weird))).toBe('inner');
  });

  it('recurses a stray top-level listItem into its child text (no dedicated case)', () => {
    const li = { type: 'listItem', content: [para(text('loose'))] };
    expect(tiptapDocToMarkdown(doc(li))).toBe('loose');
  });
});

describe('tiptapDocToMarkdown — mark branches', () => {
  it('wraps bold text in **', () => {
    expect(tiptapDocToMarkdown(doc(para(text('x', [{ type: 'bold' }]))))).toBe('**x**');
  });

  it('wraps italic text in *', () => {
    expect(tiptapDocToMarkdown(doc(para(text('x', [{ type: 'italic' }]))))).toBe('*x*');
  });

  it('wraps inline code in backticks', () => {
    expect(tiptapDocToMarkdown(doc(para(text('x', [{ type: 'code' }]))))).toBe('`x`');
  });

  it('wraps strike text in ~~', () => {
    expect(tiptapDocToMarkdown(doc(para(text('x', [{ type: 'strike' }]))))).toBe('~~x~~');
  });

  it('stacks multiple marks in declared order (bold then italic = **, then *)', () => {
    const t = text('x', [{ type: 'bold' }, { type: 'italic' }]);
    expect(tiptapDocToMarkdown(doc(para(t)))).toBe('***x***');
  });

  it('leaves unknown marks as plain text', () => {
    expect(tiptapDocToMarkdown(doc(para(text('x', [{ type: 'highlight' }]))))).toBe('x');
  });
});

describe('tiptapDocToMarkdown — golden-master (full-document behavior lock)', () => {
  // One rich document exercising heading, paragraph, inline marks, both list
  // kinds, a nested + a stray-top-level listItem, blockquote, codeBlock, hr and
  // hardBreak in a single walk. Locked to an exact byte string so ANY change in
  // how blocks compose (join separator, prefix, ordering) trips exactly here.
  // This is the durable behavior lock behind the listItem-case refactor: the
  // asserted string is identical before and after that refactor.
  it('serializes a full mixed document to the exact expected Markdown', () => {
    const document = doc(
      { type: 'heading', attrs: { level: 1 }, content: [text('Title')] },
      para(text('Plain intro with '), text('bold', [{ type: 'bold' }]), text(' and '), text('code', [{ type: 'code' }]), text('.')),
      para(text('l1'), { type: 'hardBreak' }, text('l2')),
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [para(text('first'))] },
          { type: 'listItem', content: [para(text('second'))] },
        ],
      },
      {
        type: 'orderedList',
        content: [
          { type: 'listItem', content: [para(text('alpha'))] },
          { type: 'listItem', content: [para(text('beta'))] },
        ],
      },
      { type: 'blockquote', content: [para(text('quoted line'))] },
      { type: 'codeBlock', content: [text('const x = 1;')] },
      { type: 'horizontalRule' },
      { type: 'listItem', content: [para(text('stray'))] },
    );

    const expected = [
      '# Title',
      '',
      'Plain intro with **bold** and `code`.',
      '',
      'l1  ',
      'l2',
      '',
      '- first',
      '- second',
      '',
      '1. alpha',
      '2. beta',
      '',
      '> quoted line',
      '',
      '```',
      'const x = 1;',
      '```',
      '',
      '---',
      '',
      'stray',
    ].join('\n');

    expect(tiptapDocToMarkdown(document)).toBe(expected);
  });
});
