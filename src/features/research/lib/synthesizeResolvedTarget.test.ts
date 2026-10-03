import { describe, expect, it } from 'vitest';

import { synthesizeResolvedTarget } from './synthesizeResolvedTarget';

const CARD = { title: 'The Lantern Oath', body: 'Sworn at sixteen.', asKind: 'lore' };

describe('synthesizeResolvedTarget', () => {
  it('targets the recommended entry, with the card as the fact to add', () => {
    const target = synthesizeResolvedTarget(CARD, { entryId: 'oath', name: 'The Lantern Oath' });

    expect(target).toEqual({
      category: { id: 'lore' },
      entry: { id: 'oath' },
      fact: { key: 'The Lantern Oath', value: 'Sworn at sixteen.' },
    });
  });

  it('proposes a new entry named after the card when nothing is recommended', () => {
    const target = synthesizeResolvedTarget({ ...CARD, asKind: 'character' }, null);

    expect(target.category).toEqual({ id: 'character' });
    expect(target.entry).toEqual({ proposeName: 'The Lantern Oath', proposeKind: 'character' });
  });

  it.each([['deity'], [''], ['Character']])('files a card of unknown kind %j under lore', (asKind) => {
    const target = synthesizeResolvedTarget({ ...CARD, asKind }, null);

    expect(target.category).toEqual({ id: 'lore' });
    expect(target.entry.proposeKind).toBe('lore');
  });
});
