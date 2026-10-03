import { describe, expect, it } from 'vitest';

import { entry, wiki } from './testing/wiki';
import { extractCandidatePhrases, findUnrecorded, phraseIndexKey } from './unrecorded';

const MAREN = entry('maren', 'Maren Vale', { facts: { Eyes: 'Grey' } });
const TOBIN = entry('tobin', 'Tobin Ash');
const LIGHT = entry('light', 'Verge Light', { kind: 'world', note: 'Burns tallow only' });

describe('findUnrecorded', () => {
  describe('a possession ("her mother’s brass ring")', () => {
    it('flags a possession the wiki does not record', () => {
      const [mark] = findUnrecorded(['She turned her mother’s brass ring.'], wiki(MAREN));

      expect(mark).toMatchObject({
        kind: 'missing',
        ruleId: 'unrecorded',
        quote: 'her mother’s brass ring',
        entityId: 'maren',
        importance: 'normal',
        recurrence: 1,
        position: { paragraphIndex: 0, occurrenceIndex: 0 },
      });
    });

    it('anchors the mark to the match, not to earlier text that happens to contain the quote', () => {
      const [mark] = findUnrecorded(
        ['Another mother’s brass ring lay there. She turned her mother’s brass ring.'],
        wiki(MAREN),
      );

      expect(mark?.quote).toBe('her mother’s brass ring');
      expect(mark?.position).toEqual({ paragraphIndex: 0, occurrenceIndex: 1 });
    });

    it('accepts a straight apostrophe as well as a curly one', () => {
      const [mark] = findUnrecorded(["She turned her mother's brass ring."], wiki(MAREN));

      expect(mark?.quote).toBe("her mother's brass ring");
    });

    it('ignores a possession whose object is a single word', () => {
      expect(findUnrecorded(['She turned her mother’s ring.'], wiki(MAREN))).toEqual([]);
    });

    it('cuts the object at a stop word', () => {
      expect(findUnrecorded(['She lost her mother’s ring and wept.'], wiki(MAREN))).toEqual([]);
    });

    it('stays silent once the wiki records the phrase', () => {
      const recorded = wiki(
        entry('maren', 'Maren Vale', { facts: { Carries: 'Her mother’s brass ring' } }),
      );

      expect(findUnrecorded(['She turned her mother’s brass ring.'], recorded)).toEqual([]);
    });

    it('stays silent when the wiki has no character to attribute it to', () => {
      expect(findUnrecorded(['She turned her mother’s brass ring.'], wiki(LIGHT))).toEqual([]);
    });

    it('attributes it to the character named earlier in the manuscript', () => {
      const [mark] = findUnrecorded(
        ['Tobin stood at the door.', 'He held his father’s iron key.'],
        wiki(MAREN, TOBIN),
      );

      expect(mark?.entityId).toBe('tobin');
    });

    it('falls back to the first character when nobody has been named yet', () => {
      const [mark] = findUnrecorded(['He held his father’s iron key.'], wiki(MAREN, TOBIN));

      expect(mark?.entityId).toBe('maren');
    });
  });

  describe('a named rule ("the tallow rule")', () => {
    it('flags it against the entry that mentions its subject', () => {
      const [mark] = findUnrecorded(['They broke the tallow rule.'], wiki(LIGHT));

      expect(mark).toMatchObject({ quote: 'the tallow rule', entityId: 'light', kind: 'missing' });
    });

    it('ignores a rule whose subject the wiki never mentions', () => {
      expect(findUnrecorded(['They broke the salt rule.'], wiki(LIGHT))).toEqual([]);
    });

    it('ignores a noun that is not a rule-like designator', () => {
      expect(findUnrecorded(['They lit the tallow candle.'], wiki(LIGHT))).toEqual([]);
    });
  });

  describe('importance', () => {
    it('reports a repeated phrase once, as high importance, with its count', () => {
      const marks = findUnrecorded(
        ['They broke the tallow rule.', 'Nobody forgot the tallow rule.'],
        wiki(LIGHT),
      );

      expect(marks).toHaveLength(1);
      expect(marks[0]).toMatchObject({ importance: 'high', recurrence: 2 });
      expect(marks[0]?.rail).toContain('appears 2 times');
    });

    it('raises a single mention to high when the phrase recurs in two chapters', () => {
      const counts = new Map([[phraseIndexKey('the tallow rule'), 2]]);

      const [mark] = findUnrecorded(['They broke the tallow rule.'], wiki(LIGHT), undefined, counts);

      expect(mark).toMatchObject({ importance: 'high', recurrence: 1 });
    });

    it('keeps a single mention normal when it appears in one chapter only', () => {
      const counts = new Map([[phraseIndexKey('the tallow rule'), 1]]);

      const [mark] = findUnrecorded(['They broke the tallow rule.'], wiki(LIGHT), undefined, counts);

      expect(mark?.importance).toBe('normal');
    });
  });
});

describe('phraseIndexKey', () => {
  it.each([
    ['lowercases', 'The Tallow Rule', 'the tallow rule'],
    ['straightens a curly apostrophe', 'her mother’s ring', "her mother's ring"],
    ['collapses and trims whitespace', '  the   tallow rule ', 'the tallow rule'],
  ])('%s', (_name, phrase, expected) => {
    expect(phraseIndexKey(phrase)).toBe(expected);
  });
});

describe('extractCandidatePhrases', () => {
  it('counts each candidate phrase across paragraphs, ignoring case', () => {
    const counts = extractCandidatePhrases([
      'Her mother’s brass ring shone.',
      'She kept her mother’s brass ring.',
      'They broke the tallow rule.',
    ]);

    expect([...counts]).toEqual([
      ["her mother's brass ring", 2],
      ['the tallow rule', 1],
    ]);
  });

  it('needs no wiki: a rule is a candidate even when nothing mentions its subject', () => {
    expect(extractCandidatePhrases(['They broke the salt rule.']).has('the salt rule')).toBe(true);
  });

  it('finds nothing in prose with no candidate phrases', () => {
    expect(extractCandidatePhrases(['The sea was calm.']).size).toBe(0);
  });
});
