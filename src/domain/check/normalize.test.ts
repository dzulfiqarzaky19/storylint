import { describe, expect, it } from 'vitest';

import { normalize, normalizeQuote } from './normalize';

describe('normalize', () => {
  it.each([
    ['lowercases', 'Grey', 'grey'],
    ['collapses and trims whitespace', '  Verge   Light ', 'verge light'],
    ['drops a leading article', 'The Verge Light', 'verge light'],
    ['keeps an article that is the whole value', 'the', 'the'],
    ['keeps an article that is not leading', 'keeper of the light', 'keeper of the light'],
    ['turns a number word into digits', 'four', '4'],
    ['turns a hyphenated number word into digits', 'Twenty-One', '21'],
    ['strips a plural s', 'four legs', '4 leg'],
    ['keeps a double s', 'glass', 'glass'],
    ['keeps a short word ending in s', 'his', 'his'],
    ['returns empty for empty input', '', ''],
    ['returns empty for whitespace', '   ', ''],
  ])('%s', (_name, input, expected) => {
    expect(normalize(input)).toBe(expected);
  });

  it('makes a number word and its plural noun equal to the singular digit form', () => {
    expect(normalize('Four Legs')).toBe(normalize('4 leg'));
  });
});

describe('normalizeQuote', () => {
  it.each([
    ['lowercases', 'Her Brass Ring', 'her brass ring'],
    ['collapses and trims whitespace', ' her  brass ring ', 'her brass ring'],
    ['straightens a curly apostrophe', 'her mother’s ring', "her mother's ring"],
    ['keeps articles and plurals, unlike normalize', 'The Legs', 'the legs'],
  ])('%s', (_name, input, expected) => {
    expect(normalizeQuote(input)).toBe(expected);
  });
});
