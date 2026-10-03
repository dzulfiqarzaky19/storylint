import { describe, expect, it } from 'vitest';

import { occurrenceIndexOf, splitSentences, words } from './text';

describe('splitSentences', () => {
  it.each([
    ['splits on . ! ? followed by whitespace', 'One. Two! Three? Four', ['One.', 'Two!', 'Three?', 'Four']],
    ['keeps a terminator that has no whitespace after it', 'v1.2 shipped.', ['v1.2 shipped.']],
    ['trims each sentence', '  One.   Two.  ', ['One.', 'Two.']],
    ['returns nothing for an empty paragraph', '', []],
    ['returns nothing for whitespace', '   ', []],
  ])('%s', (_name, paragraph, expected) => {
    expect(splitSentences(paragraph)).toEqual(expected);
  });
});

describe('occurrenceIndexOf', () => {
  it('anchors a quote that appears once to occurrence 0', () => {
    expect(occurrenceIndexOf('The chair had four legs.', 'four legs', 14)).toBe(0);
  });

  it.each([
    ['the first', 0, 0],
    ['the second', 16, 1],
    ['the third', 31, 2],
  ])('anchors %s of a repeated quote to its own occurrence', (_name, at, expected) => {
    const paragraph = 'four legs, then four legs, and four legs';
    expect(occurrenceIndexOf(paragraph, 'four legs', at)).toBe(expected);
  });

  it('counts occurrences the way the range resolver walks them, without overlap', () => {
    expect(occurrenceIndexOf('aaaa', 'aa', 2)).toBe(1);
  });

  it('returns 0 when the quote is not in the paragraph', () => {
    expect(occurrenceIndexOf('The chair had four legs.', 'five legs', 14)).toBe(0);
  });

  it('returns 0 for an empty quote', () => {
    expect(occurrenceIndexOf('The chair had four legs.', '', 14)).toBe(0);
  });
});

describe('words', () => {
  it.each([
    ['lowercases and splits on non-word characters', 'Maren, the Keeper!', ['maren', 'the', 'keeper']],
    ['keeps inner apostrophes and hyphens', "Maren's brass-ring", ["maren's", 'brass-ring']],
    ['keeps a curly apostrophe', 'mother’s', ['mother’s']],
    ['keeps digits', 'chapter 42', ['chapter', '42']],
    ['returns nothing for empty text', '', []],
    ['returns nothing for punctuation only', '— … !', []],
  ])('%s', (_name, text, expected) => {
    expect(words(text)).toEqual(expected);
  });
});
