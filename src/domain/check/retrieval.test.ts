import { describe, expect, it } from 'vitest';

import { snapshot, snapshotEntry } from '@/domain/testing/snapshot';
import { findRetrievalMisses, selectGazetteer } from './retrieval';

function ids(selection: { entries: { id: string }[] }): string[] {
  return selection.entries.map((e) => e.id);
}

describe('selectGazetteer', () => {
  const MAREN = snapshotEntry('maren', 'Maren Vale');
  const LIGHT = snapshotEntry('light', 'Verge Light', { kind: 'world' });
  const RING = snapshotEntry('ring', 'Heirloom', { kind: 'lore', facts: { Is: 'a brass ring' } });
  const OTHER = snapshotEntry('other', 'Saint Osk');

  it('selects an entry whose name appears in the text', () => {
    const selection = selectGazetteer(snapshot(MAREN, OTHER), { text: 'Maren Vale climbed.' });

    expect(ids(selection)).toEqual(['maren']);
  });

  it('selects an entry whose fact value appears in the text', () => {
    const selection = selectGazetteer(snapshot(RING, OTHER), { text: 'She wore a brass ring.' });

    expect(ids(selection)).toEqual(['ring']);
  });

  it('selects an entry when one part of a comma-separated fact value appears in the text', () => {
    const kit = snapshotEntry('kit', 'Kit', { kind: 'lore', facts: { Holds: 'a lantern, an iron key' } });

    const selection = selectGazetteer(snapshot(kit, OTHER), { text: 'He found an iron key.' });

    expect(ids(selection)).toEqual(['kit']);
  });

  it('selects an entry whose name words all appear, even apart', () => {
    const selection = selectGazetteer(snapshot(MAREN, OTHER), { text: 'Vale, said Maren.' });

    expect(ids(selection)).toEqual(['maren']);
  });

  it('leaves out an entry the text never mentions', () => {
    expect(ids(selectGazetteer(snapshot(OTHER), { text: 'Maren Vale climbed.' }))).toEqual([]);
  });

  it('always includes a focused entry, mentioned or not', () => {
    const selection = selectGazetteer(snapshot(MAREN, OTHER), {
      text: 'The sea was calm.',
      focusEntityIds: ['other'],
    });

    expect(ids(selection)).toEqual(['other']);
  });

  it('pulls in the entries a selected entry is tied to', () => {
    const tied = snapshotEntry('maren', 'Maren Vale', { ties: ['light'] });

    const selection = selectGazetteer(snapshot(tied, LIGHT, OTHER), { text: 'Maren Vale climbed.' });

    expect(ids(selection)).toEqual(['maren', 'light']);
  });

  it('ignores a tie that points at an entry outside the snapshot', () => {
    const dangling = snapshotEntry('maren', 'Maren Vale', { ties: ['gone'] });

    expect(ids(selectGazetteer(snapshot(dangling), { text: 'Maren Vale climbed.' }))).toEqual(['maren']);
  });

  it('returns entries in wiki order, not match order', () => {
    const selection = selectGazetteer(snapshot(LIGHT, MAREN), {
      text: 'Maren Vale reached the Verge Light.',
    });

    expect(ids(selection)).toEqual(['light', 'maren']);
  });

  describe('the entry cap', () => {
    it('never cuts a certain match, and says the cap was raised', () => {
      const selection = selectGazetteer(snapshot(MAREN, LIGHT), {
        text: 'Maren Vale reached the Verge Light.',
        maxEntries: 1,
      });

      expect(ids(selection)).toEqual(['maren', 'light']);
      expect(selection.capRaised).toBe(true);
    });

    it('drops a loose match when certain matches already fill the cap', () => {
      const selection = selectGazetteer(snapshot(LIGHT, MAREN), {
        text: 'Vale, said Maren, at the Verge Light.',
        maxEntries: 1,
      });

      expect(ids(selection)).toEqual(['light']);
      expect(selection.capRaised).toBe(false);
    });

    it('fills the remaining room with the loose match that has the most name words', () => {
      const longName = snapshotEntry('tom', 'Old Tom Reed');
      const shortName = snapshotEntry('ann', 'Ann Lee');

      const selection = selectGazetteer(snapshot(shortName, longName), {
        text: 'Reed, old as ever, called Tom; Lee waved at Ann.',
        maxEntries: 1,
      });

      expect(ids(selection)).toEqual(['tom']);
    });
  });
});

describe('findRetrievalMisses', () => {
  it('lists the ids the model echoed that were never sent to it', () => {
    expect(findRetrievalMisses(['maren', 'ghost'], ['maren'])).toEqual(['ghost']);
  });

  it('lists each missing id once, trimmed', () => {
    expect(findRetrievalMisses([' ghost ', 'ghost'], [])).toEqual(['ghost']);
  });

  it('ignores blank and undefined ids', () => {
    expect(findRetrievalMisses([undefined, '', '  '], [])).toEqual([]);
  });

  it('finds no misses when everything echoed was sent', () => {
    expect(findRetrievalMisses(['maren'], ['maren', 'light'])).toEqual([]);
  });
});
