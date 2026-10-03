import { describe, expect, it } from 'vitest';

import { snapshotEntry } from '@/domain/testing/snapshot';
import {
  createCategoryInState,
  deleteCategoryInState,
  renameCategoryInState,
} from './categories';
import { category, stateOf } from './testing/state';

const MAREN = snapshotEntry('maren', 'Maren Vale');
const TOBIN = snapshotEntry('tobin', 'Tobin Ash');
const LIGHT = snapshotEntry('light', 'Verge Light', { kind: 'world' });

const PEOPLE = category('character', 'People', { shelf: 'people', isBuiltin: true });
const PLACES = category('world', 'Places', { shelf: 'places', isBuiltin: true, sortOrder: 1 });
const SHIPS = category('ships', 'Ships', { sortOrder: 5 });

describe('deleteCategoryInState', () => {
  it('removes the category and every entry of that kind', () => {
    const state = stateOf([MAREN, LIGHT, TOBIN], { categories: [PEOPLE, PLACES] });

    const next = deleteCategoryInState(state, 'character');

    expect(next.categories).toEqual([PLACES]);
    expect(Object.keys(next.byId)).toEqual(['light']);
    expect(next.order.people).toEqual([]);
  });

  it('leaves entries of other kinds where they are', () => {
    const state = stateOf([MAREN, LIGHT], { categories: [PEOPLE, PLACES] });

    const next = deleteCategoryInState(state, 'character');

    expect(next.order.places).toEqual(['light']);
  });

  it('clears the selection when the selected entry goes with its category', () => {
    const state = stateOf([MAREN, LIGHT], { categories: [PEOPLE, PLACES] });

    expect(deleteCategoryInState(state, 'character').selectedEntryId).toBeNull();
  });
});

describe('createCategoryInState', () => {
  it('adds the category in sort order', () => {
    const state = stateOf([], { categories: [PEOPLE, SHIPS] });

    const next = createCategoryInState(state, PLACES);

    expect(next.categories.map((c) => c.id)).toEqual(['character', 'world', 'ships']);
  });

  it('returns the same state when the category already exists', () => {
    const state = stateOf([], { categories: [PEOPLE] });

    expect(createCategoryInState(state, PEOPLE)).toBe(state);
  });
});

describe('renameCategoryInState', () => {
  it('renames a built-in category and records the override, trimmed', () => {
    const state = stateOf([], { categories: [PEOPLE] });

    const next = renameCategoryInState(state, 'character', '  Cast ');

    expect(next.categories[0]?.label).toBe('Cast');
    expect(next.overrides).toEqual({ character: 'Cast' });
  });

  it('resets a built-in category to its default name when the new label is blank', () => {
    const renamed = stateOf([], {
      categories: [{ ...PEOPLE, label: 'Cast' }],
      overrides: { character: 'Cast' },
    });

    const next = renameCategoryInState(renamed, 'character', '   ');

    expect(next.categories[0]?.label).toBe('People');
    expect(next.overrides).toEqual({});
  });

  it('renames a custom category without touching the built-in overrides', () => {
    const state = stateOf([], { categories: [SHIPS], overrides: { character: 'Cast' } });

    const next = renameCategoryInState(state, 'ships', 'Vessels');

    expect(next.categories[0]?.label).toBe('Vessels');
    expect(next.overrides).toEqual({ character: 'Cast' });
  });

  it('keeps a custom category’s name when the new label is blank', () => {
    const state = stateOf([], { categories: [SHIPS] });

    expect(renameCategoryInState(state, 'ships', '  ').categories[0]?.label).toBe('Ships');
  });

  it('leaves other categories alone', () => {
    const state = stateOf([], { categories: [PEOPLE, PLACES] });

    expect(renameCategoryInState(state, 'character', 'Cast').categories[1]).toEqual(PLACES);
  });
});
