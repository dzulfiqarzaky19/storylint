import { describe, expect, it } from 'vitest';

import { kindForNewEntry } from './createEntryKind';

describe('kindForNewEntry', () => {
  it('uses the category the entry is being created in', () => {
    expect(kindForNewEntry('lore', 'ships')).toBe('ships');
  });

  it.each([
    ['people', 'character'],
    ['places', 'world'],
    ['orders', 'organization'],
    ['lore', 'lore'],
  ] as const)('falls back to the built-in kind of the %s shelf: %s', (shelf, kind) => {
    expect(kindForNewEntry(shelf)).toBe(kind);
  });
});
