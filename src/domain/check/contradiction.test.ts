import { describe, expect, it } from 'vitest';

import { findContradictions } from './contradiction';
import { entry, wiki } from './testing/wiki';

const MAREN = entry('maren', 'Maren Vale', { facts: { Eyes: 'Grey' } });

describe('findContradictions', () => {
  it('finds nothing in a manuscript that agrees with the wiki', () => {
    expect(findContradictions(['Her grey eyes narrowed.'], wiki(MAREN))).toEqual([]);
  });

  it('finds nothing when the wiki records no fact a rule checks', () => {
    const noFacts = wiki(entry('maren', 'Maren Vale'));

    expect(findContradictions(['Her green eyes narrowed.'], noFacts)).toEqual([]);
  });

  it('anchors a mark to the paragraph the contradiction is in', () => {
    const marks = findContradictions(
      ['Maren climbed the stair.', 'Her green eyes narrowed.'],
      wiki(MAREN),
    );

    expect(marks).toHaveLength(1);
    expect(marks[0]?.position).toEqual({ paragraphIndex: 1, occurrenceIndex: 0 });
  });

  it('anchors a mark to the sentence that contradicts, not to earlier words that match it', () => {
    const [mark] = findContradictions(
      ['Grey eyes met green eyes. Then green eyes closed.'],
      wiki(MAREN),
    );

    expect(mark?.quote).toBe('green eyes');
    expect(mark?.position).toEqual({ paragraphIndex: 0, occurrenceIndex: 1 });
  });

  it('reports the same contradiction once however often the manuscript repeats it', () => {
    const marks = findContradictions(
      ['Her green eyes narrowed.', 'Later, her green eyes closed.'],
      wiki(MAREN),
    );

    expect(marks).toHaveLength(1);
    expect(marks[0]?.position.paragraphIndex).toBe(0);
  });

  it('gives the same mark key whatever the case and spacing of the quote', () => {
    const [a] = findContradictions(['Her green eyes narrowed.'], wiki(MAREN));
    const [b] = findContradictions(['HER GREEN EYES narrowed.'], wiki(MAREN));

    expect(a?.markKey).toBe(b?.markKey);
  });

  describe('attribute mismatch (Eyes)', () => {
    it('flags an eye colour that differs from the recorded one', () => {
      const [mark] = findContradictions(['Maren turned. Her green eyes narrowed.'], wiki(MAREN));

      expect(mark).toMatchObject({
        kind: 'conflict',
        ruleId: 'attribute-mismatch',
        quote: 'Her green eyes',
        entityId: 'maren',
        checkedAgainst: {
          factId: 'maren.Eyes',
          entryId: 'maren',
          factKey: 'Eyes',
          recordedValue: 'Grey',
        },
        resolvedTarget: { entry: { id: 'maren' }, fact: { key: 'Eyes', value: 'Green' } },
      });
    });

    it('quotes only the colour and noun when no possessive leads into it', () => {
      const [mark] = findContradictions(['Green eyes met hers.'], wiki(MAREN));

      expect(mark?.quote).toBe('Green eyes');
    });

    it('compares case-insensitively', () => {
      expect(findContradictions(['Her GREY eyes narrowed.'], wiki(MAREN))).toEqual([]);
    });
  });

  describe('member count (Members)', () => {
    const GUILD = entry('guild', 'The Lantern Guild', {
      kind: 'organization',
      facts: { Members: 'Twelve sworn keepers' },
    });

    it('flags a count that differs from the recorded number', () => {
      const [mark] = findContradictions(['The guild kept nine members that winter.'], wiki(GUILD));

      expect(mark).toMatchObject({
        ruleId: 'member-count',
        quote: 'nine members',
        entityId: 'guild',
        resolvedTarget: { fact: { key: 'Members', value: 'Nine' } },
      });
    });

    it('accepts the recorded count', () => {
      expect(findContradictions(['All twelve members stood.'], wiki(GUILD))).toEqual([]);
    });

    it('stays silent when the recorded value holds no number word', () => {
      const vague = wiki(entry('guild', 'The Lantern Guild', { facts: { Members: 'Many' } }));

      expect(findContradictions(['The guild kept nine members.'], vague)).toEqual([]);
    });
  });

  describe('constraint violation (Age against the oath)', () => {
    const OATH = entry('oath', 'The Lantern Oath', { kind: 'lore', facts: { 'Sworn at': 'Sixteen' } });
    const YOUNG = entry('maren', 'Maren Vale', { facts: { Age: 'Fourteen' } });

    it('flags a character sworn at their recorded age when the oath requires another', () => {
      const [mark] = findContradictions(['She was fourteen when sworn.'], wiki(YOUNG, OATH));

      expect(mark).toMatchObject({
        ruleId: 'constraint-violation',
        quote: 'fourteen when sworn',
        entityId: 'maren',
        checkedAgainst: { factKey: 'Age', recordedValue: 'Fourteen' },
      });
    });

    it('accepts swearing at the age the oath requires', () => {
      expect(findContradictions(['She was sixteen when sworn.'], wiki(YOUNG, OATH))).toEqual([]);
    });

    it('stays silent when the age in the sentence is not this character’s recorded age', () => {
      expect(findContradictions(['He was twelve when sworn.'], wiki(YOUNG, OATH))).toEqual([]);
    });

    it('stays silent when the wiki has no oath to violate', () => {
      expect(findContradictions(['She was fourteen when sworn.'], wiki(YOUNG))).toEqual([]);
    });
  });
});
