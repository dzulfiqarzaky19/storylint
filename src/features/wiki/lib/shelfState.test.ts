import { describe, expect, it } from 'vitest';

import { initialCollapse, isEmptyCategory, resolveRename } from './shelfState';

describe('isEmptyCategory', () => {
  it.each([
    [0, true],
    [1, false],
  ])('with %i entries: %s', (entryCount, expected) => {
    expect(isEmptyCategory(entryCount)).toBe(expected);
  });
});

describe('resolveRename', () => {
  it('renames to the new title', () => {
    expect(resolveRename('Cast', 'People')).toEqual({ action: 'rename', label: 'Cast' });
  });

  it.each([[''], ['   ']])('resets to the default title when the draft is %j', (draft) => {
    expect(resolveRename(draft, 'Cast')).toEqual({ action: 'reset' });
  });

  it.each([['People'], ['  People ']])('does nothing when the draft %j is the current title', (draft) => {
    expect(resolveRename(draft, 'People')).toEqual({ action: 'noop' });
  });
});

describe('initialCollapse', () => {
  it('starts every category expanded', () => {
    expect(initialCollapse(['character', 'ships'])).toEqual({ character: false, ships: false });
  });

  it('returns an empty map for no categories', () => {
    expect(initialCollapse([])).toEqual({});
  });
});
