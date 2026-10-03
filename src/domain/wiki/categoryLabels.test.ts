import { describe, expect, it } from 'vitest';

import type { CategoryRow } from '@/domain/types';
import {
  applyCategoryRename,
  applyCategoryReset,
  categoryLabelById,
  categorySingular,
  defaultCategoryShelf,
  resolveCategoryLabel,
} from './categoryLabels';

describe('resolveCategoryLabel', () => {
  it('uses the override when there is one', () => {
    expect(resolveCategoryLabel('character', { character: 'Cast' })).toBe('Cast');
  });

  it.each([
    ['there is no override', {}],
    ['the override is blank', { character: '   ' }],
  ])('uses the default shelf title when %s', (_name, overrides) => {
    expect(resolveCategoryLabel('character', overrides)).toBe('People');
  });
});

describe('applyCategoryRename', () => {
  it('records the new label, trimmed', () => {
    expect(applyCategoryRename({}, 'character', '  Cast ')).toEqual({ character: 'Cast' });
  });

  it('removes the override when the label is blank', () => {
    expect(applyCategoryRename({ character: 'Cast', world: 'Realms' }, 'character', '  ')).toEqual({
      world: 'Realms',
    });
  });

  it('returns a new object and leaves the input alone', () => {
    const overrides = Object.freeze({ character: 'Cast' });

    expect(applyCategoryRename(overrides, 'character', 'Folk')).toEqual({ character: 'Folk' });
    expect(overrides).toEqual({ character: 'Cast' });
  });
});

describe('applyCategoryReset', () => {
  it('removes the override for that kind only', () => {
    expect(applyCategoryReset({ character: 'Cast', world: 'Realms' }, 'character')).toEqual({ world: 'Realms' });
  });

  it('is a no-op for a kind with no override', () => {
    expect(applyCategoryReset({ world: 'Realms' }, 'character')).toEqual({ world: 'Realms' });
  });
});

describe('categoryLabelById', () => {
  const SHIPS: CategoryRow = {
    id: 'ships',
    label: 'Ships',
    shelf: 'lore',
    sortOrder: 0,
    isBuiltin: false,
    deletedAt: null,
  };

  it('uses the label of the stored category', () => {
    expect(categoryLabelById([SHIPS], 'ships')).toBe('Ships');
  });

  it('uses the default shelf title for a built-in kind that has no stored row', () => {
    expect(categoryLabelById([], 'world')).toBe('Places');
  });

  it('falls back to the id for an unknown category', () => {
    expect(categoryLabelById([], 'unknown')).toBe('unknown');
  });
});

describe('defaultCategoryShelf', () => {
  it('files a new custom category on the lore shelf', () => {
    expect(defaultCategoryShelf()).toBe('lore');
  });
});

describe('categorySingular', () => {
  it.each([
    ['Places', 'place'],
    ['Orders', 'order'],
    ['Lore', 'lore'],
    ['People', 'people'],
  ])('turns "%s" into "%s"', (label, expected) => {
    expect(categorySingular(label)).toBe(expected);
  });
});
