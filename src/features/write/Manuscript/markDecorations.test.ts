import { Schema } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';

import { mark } from '@/domain/check/testing/wiki';
import { resolveMarkRange, resolveSentenceRange, sentenceBounds } from './markDecorations';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    text: {},
  },
});

function docOf(...paragraphs: string[]) {
  return schema.node(
    'doc',
    null,
    paragraphs.map((text) => schema.node('paragraph', null, text ? [schema.text(text)] : [])),
  );
}

const anchored = (quote: string, paragraphIndex: number, occurrenceIndex = 0) =>
  mark({ quote, position: { paragraphIndex, occurrenceIndex } });

const FIRST = 'One. Two three. Four';
const SECOND = 'a four legs b four legs';
const DOC = docOf(FIRST, SECOND);

/** The text a document range covers, which is what the reader would see underlined. */
function textAt(range: { from: number; to: number } | null): string | null {
  return range ? DOC.textBetween(range.from, range.to) : null;
}

describe('resolveMarkRange', () => {
  it('finds a quote in the first paragraph', () => {
    const range = resolveMarkRange(DOC, anchored('three', 0));

    expect(range).toEqual({ from: 10, to: 15 });
    expect(textAt(range)).toBe('three');
  });

  it('finds a quote in a later paragraph', () => {
    expect(textAt(resolveMarkRange(DOC, anchored('legs', 1)))).toBe('legs');
  });

  it('picks the occurrence the anchor names when the quote repeats', () => {
    const first = resolveMarkRange(DOC, anchored('four legs', 1, 0));
    const second = resolveMarkRange(DOC, anchored('four legs', 1, 1));

    expect(first).toEqual({ from: 25, to: 34 });
    expect(second).toEqual({ from: 37, to: 46 });
  });

  it.each([
    ['the quote is not in that paragraph', anchored('three', 1)],
    ['the paragraph does not exist', anchored('three', 9)],
    ['the quote does not repeat that many times', anchored('four legs', 1, 2)],
  ])('returns null when %s', (_name, stale) => {
    expect(resolveMarkRange(DOC, stale)).toBeNull();
  });
});

describe('sentenceBounds', () => {
  it.each([
    ['the first sentence', 0, 3, 'One.'],
    ['a middle sentence, without the space before it', 9, 14, 'Two three.'],
    ['the last sentence, which has no terminator', 16, 20, 'Four'],
  ])('finds %s', (_name, runStart, runEnd, expected) => {
    const { start, end } = sentenceBounds(FIRST, runStart, runEnd);

    expect(FIRST.slice(start, end)).toBe(expected);
  });

  it('returns the whole paragraph when it holds a single sentence', () => {
    expect(sentenceBounds('No terminator here', 3, 13)).toEqual({ start: 0, end: 18 });
  });

  it.each([['!'], ['?']])('treats "%s" as a sentence end', (terminator) => {
    const text = `Stop${terminator} Go on.`;

    const { start, end } = sentenceBounds(text, 6, 8);

    expect(text.slice(start, end)).toBe('Go on.');
  });
});

describe('resolveSentenceRange', () => {
  it('returns the sentence around the mark, with its document range', () => {
    const sentence = resolveSentenceRange(DOC, anchored('three', 0));

    expect(sentence?.text).toBe('Two three.');
    expect(textAt(sentence)).toBe('Two three.');
  });

  it('returns the whole paragraph when the sentence has no terminators around it', () => {
    expect(resolveSentenceRange(DOC, anchored('legs b', 1))?.text).toBe(SECOND);
  });

  it('returns null when the mark can no longer be found', () => {
    expect(resolveSentenceRange(DOC, anchored('gone', 0))).toBeNull();
  });
});
