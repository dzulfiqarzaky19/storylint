import { describe, expect, it } from 'vitest';

import { snapshotEntry } from '@/domain/testing/snapshot';
import { wikiReducer, type WikiAction } from './index';
import { category, stateOf, suggestion } from './testing/state';

const MAREN = snapshotEntry('maren', 'Maren Vale', { facts: { Eyes: 'Grey' }, ties: ['light'] });
const LIGHT = snapshotEntry('light', 'Verge Light', { kind: 'world' });
const PEOPLE = category('character', 'Cast', { shelf: 'people', isBuiltin: true });
const SHIPS = category('ships', 'Ships');

describe('wikiReducer', () => {
  it('selects an entry', () => {
    const next = wikiReducer(stateOf([MAREN, LIGHT]), { type: 'SELECT_ENTRY', entryId: 'light' });

    expect(next.selectedEntryId).toBe('light');
  });

  it('clears the selection', () => {
    const next = wikiReducer(stateOf([MAREN]), { type: 'SELECT_ENTRY', entryId: null });

    expect(next.selectedEntryId).toBeNull();
  });

  it('dismisses one suggestion and keeps the rest', () => {
    const state = stateOf([MAREN], { suggestions: [suggestion('s1', 'maren'), suggestion('s2', 'maren')] });

    const next = wikiReducer(state, { type: 'DISMISS_SUGGESTION', suggestionKey: 's1' });

    expect(next.suggestions.map((s) => s.suggestionKey)).toEqual(['s2']);
  });

  it('sets and clears the error', () => {
    const failed = wikiReducer(stateOf([MAREN]), { type: 'SET_ERROR', error: 'Save failed' });
    expect(failed.error).toBe('Save failed');

    expect(wikiReducer(failed, { type: 'SET_ERROR', error: null }).error).toBeNull();
  });

  describe('RESET_CATEGORY', () => {
    it('gives a built-in category its default name back and drops the override', () => {
      const state = stateOf([], { categories: [PEOPLE], overrides: { character: 'Cast' } });

      const next = wikiReducer(state, { type: 'RESET_CATEGORY', kind: 'character' });

      expect(next.categories[0]?.label).toBe('People');
      expect(next.overrides).toEqual({});
    });

    it('returns the same state for a custom category, which has no default', () => {
      const state = stateOf([], { categories: [SHIPS] });

      expect(wikiReducer(state, { type: 'RESET_CATEGORY', kind: 'ships' })).toBe(state);
    });
  });

  // Each of these is covered in depth beside its *InState function. This table
  // only proves the reducer routes the action there.
  it.each<[WikiAction['type'], WikiAction]>([
    ['MOVE_ENTRY', { type: 'MOVE_ENTRY', entryId: 'maren', toShelf: 'lore', beforeId: null }],
    ['LINK_ENTRY', { type: 'LINK_ENTRY', tieId: 't9', fromEntryId: 'light', toEntryId: 'maren', rel: 'lit by' }],
    ['MOVE_FACT', { type: 'MOVE_FACT', factId: 'maren.Eyes', fromEntryId: 'maren', toEntryId: 'light' }],
    [
      'ADD_SUGGESTION_AS_FACT',
      { type: 'ADD_SUGGESTION_AS_FACT', suggestionKey: 's1', entryId: 'maren', factId: 'f9', key: 'k', value: 'v', sortOrder: 1 },
    ],
    ['EDIT_ENTRY_FIELDS', { type: 'EDIT_ENTRY_FIELDS', entryId: 'maren', name: 'Maren' }],
    ['EDIT_FACT', { type: 'EDIT_FACT', entryId: 'maren', factId: 'maren.Eyes', value: 'Green' }],
    [
      'CREATE_ENTRY',
      { type: 'CREATE_ENTRY', entryId: 'osk', kind: 'lore', shelf: 'lore', name: 'Osk', note: '', summary: '', sortOrder: 0 },
    ],
    ['CREATE_FACT', { type: 'CREATE_FACT', entryId: 'maren', factId: 'f9', key: 'k', value: 'v', sortOrder: 1 }],
    ['DELETE_FACT', { type: 'DELETE_FACT', entryId: 'maren', factId: 'maren.Eyes' }],
    ['SOFT_DELETE_ENTRY', { type: 'SOFT_DELETE_ENTRY', entryId: 'maren' }],
    ['UNTIE', { type: 'UNTIE', fromEntryId: 'maren', tieId: 'maren>light' }],
    [
      'CREATE_TIED',
      { type: 'CREATE_TIED', entryId: 'osk', tieId: 't9', kind: 'lore', shelf: 'lore', name: 'Osk', toEntryId: 'maren', rel: 'prays to' },
    ],
    ['CREATE_CATEGORY', { type: 'CREATE_CATEGORY', category: SHIPS }],
    ['RENAME_CATEGORY', { type: 'RENAME_CATEGORY', kind: 'character', label: 'Folk' }],
    ['DELETE_CATEGORY', { type: 'DELETE_CATEGORY', kind: 'character' }],
    ['RESTORE_ENTRY', { type: 'RESTORE_ENTRY', entry: snapshotEntry('osk', 'Saint Osk', { kind: 'lore' }) }],
  ])('applies %s without mutating the previous state', (_type, action) => {
    const state = stateOf([MAREN, LIGHT], {
      categories: [PEOPLE],
      suggestions: [suggestion('s1', 'maren')],
    });
    const before = structuredClone(state);

    const next = wikiReducer(state, action);

    expect(next).not.toEqual(before);
    expect(state).toEqual(before);
  });
});
