import { describe, expect, it } from 'vitest';

import { buildLexicon } from './lexicon';
import { entry, wiki } from './testing/wiki';

const lexicon = buildLexicon(
  wiki(
    entry('maren', 'Maren Vale', {
      aliases: ['the Keeper'],
      note: 'Wears a brass ring',
      facts: { Eyes: 'Grey', Carries: 'a lantern, a brass key' },
    }),
  ),
);

describe('buildLexicon', () => {
  it.each([
    ['an entry name', 'Maren Vale'],
    ['an entry name with different case and a leading article', 'the maren vale'],
    ['an alias', 'Keeper'],
    ['a whole fact value', 'Grey'],
    ['one part of a comma-separated fact value', 'a brass key'],
    ['a fragment of 3 or more characters inside a recorded phrase', 'lantern'],
    ['a phrase whose content words all appear somewhere in the wiki', 'her brass ring'],
    ['an empty phrase', ''],
  ])('knows %s', (_name, phrase) => {
    expect(lexicon.has(phrase)).toBe(true);
  });

  it.each([
    ['a phrase with a word the wiki never uses', 'the tallow rule'],
    ['a phrase where only some content words are recorded', 'her brass compass'],
    ['a fragment shorter than 3 characters', 'ma'],
  ])('does not know %s', (_name, phrase) => {
    expect(lexicon.has(phrase)).toBe(false);
  });

  it('knows nothing but the empty phrase when the wiki is empty', () => {
    const empty = buildLexicon(wiki());

    expect(empty.has('Maren Vale')).toBe(false);
    expect(empty.has('')).toBe(true);
  });
});
