import { afterEach, describe, expect, it, vi } from 'vitest';

import { snapshot, snapshotEntry } from '@/domain/testing/snapshot';
import type { Shelf } from '@/domain/types';
import {
  createEntryInState,
  editEntryFieldsInState,
  initWikiState,
  moveEntryInState,
  restoreEntryInState,
  softDeleteEntryInState,
} from './entries';
import { stateOf, suggestion } from './testing/state';

const MAREN = snapshotEntry('maren', 'Maren Vale');
const TOBIN = snapshotEntry('tobin', 'Tobin Ash');
const LIGHT = snapshotEntry('light', 'Verge Light', { kind: 'world' });

describe('initWikiState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('files each entry on its shelf, in snapshot order', () => {
    const state = initWikiState(snapshot(MAREN, LIGHT, TOBIN));

    expect(state.order).toEqual({
      people: ['maren', 'tobin'],
      places: ['light'],
      orders: [],
      lore: [],
    });
  });

  it('selects the first entry', () => {
    expect(initWikiState(snapshot(LIGHT, MAREN)).selectedEntryId).toBe('light');
  });

  it('selects nothing in an empty wiki', () => {
    expect(initWikiState(snapshot()).selectedEntryId).toBeNull();
  });

  it('starts with the given suggestions and no error', () => {
    const suggestions = [suggestion('s1', 'maren')];

    const state = initWikiState(snapshot(MAREN), suggestions);

    expect(state.suggestions).toEqual(suggestions);
    expect(state.error).toBeNull();
  });

  it('skips an entry whose stored shelf is not a known shelf, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stray = snapshotEntry('stray', 'Stray', { shelf: 'attic' as Shelf });

    const state = initWikiState(snapshot(MAREN, stray));

    expect(Object.values(state.order).flat()).toEqual(['maren']);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('moveEntryInState', () => {
  it('moves an entry to the end of another shelf and updates its shelf', () => {
    const next = moveEntryInState(stateOf([MAREN, TOBIN, LIGHT]), 'maren', 'places', null);

    expect(next.order.people).toEqual(['tobin']);
    expect(next.order.places).toEqual(['light', 'maren']);
    expect(next.byId.maren?.shelf).toBe('places');
  });

  it('inserts the entry before the given entry', () => {
    const next = moveEntryInState(stateOf([MAREN, TOBIN, LIGHT]), 'maren', 'places', 'light');

    expect(next.order.places).toEqual(['maren', 'light']);
  });

  it('reorders within the same shelf', () => {
    const next = moveEntryInState(stateOf([MAREN, TOBIN]), 'tobin', 'people', 'maren');

    expect(next.order.people).toEqual(['tobin', 'maren']);
  });

  it('appends when the entry to insert before is not on that shelf', () => {
    const next = moveEntryInState(stateOf([MAREN, TOBIN, LIGHT]), 'maren', 'places', 'tobin');

    expect(next.order.places).toEqual(['light', 'maren']);
  });
});

describe('editEntryFieldsInState', () => {
  it('changes only the fields it was given', () => {
    const next = editEntryFieldsInState(stateOf([MAREN]), { entryId: 'maren', note: 'Keeper' });

    expect(next.byId.maren).toEqual({ ...MAREN, note: 'Keeper' });
  });

  it('treats an empty string as a real value, not as "unchanged"', () => {
    const noted = snapshotEntry('maren', 'Maren Vale', { note: 'Keeper' });

    const next = editEntryFieldsInState(stateOf([noted]), { entryId: 'maren', note: '' });

    expect(next.byId.maren?.note).toBe('');
  });

  it('returns the same state for an entry that does not exist', () => {
    const state = stateOf([MAREN]);

    expect(editEntryFieldsInState(state, { entryId: 'ghost', name: 'x' })).toBe(state);
  });
});

describe('createEntryInState', () => {
  const NEW_ENTRY = {
    entryId: 'osk',
    kind: 'lore',
    shelf: 'lore',
    name: 'Saint Osk',
    note: 'A saint',
    summary: '',
    sortOrder: 3,
  } as const;

  it('adds an empty entry with a placeholder catalogue number', () => {
    const next = createEntryInState(stateOf([MAREN]), NEW_ENTRY);

    expect(next.byId.osk).toMatchObject({
      id: 'osk',
      name: 'Saint Osk',
      kind: 'lore',
      shelf: 'lore',
      catalogueNo: '—',
      deletedAt: null,
      facts: [],
      ties: [],
    });
  });

  it('puts it at the end of its shelf and selects it', () => {
    const lore = snapshotEntry('oath', 'The Lantern Oath', { kind: 'lore' });

    const next = createEntryInState(stateOf([MAREN, lore]), NEW_ENTRY);

    expect(next.order.lore).toEqual(['oath', 'osk']);
    expect(next.selectedEntryId).toBe('osk');
  });
});

describe('softDeleteEntryInState', () => {
  it('removes the entry from the wiki and from its shelf', () => {
    const next = softDeleteEntryInState(stateOf([MAREN, TOBIN]), 'tobin');

    expect(Object.keys(next.byId)).toEqual(['maren']);
    expect(next.order.people).toEqual(['maren']);
  });

  it('clears the selection when the selected entry is deleted', () => {
    const next = softDeleteEntryInState(stateOf([MAREN, TOBIN]), 'maren');

    expect(next.selectedEntryId).toBeNull();
  });

  it('keeps the selection when another entry is deleted', () => {
    const next = softDeleteEntryInState(stateOf([MAREN, TOBIN]), 'tobin');

    expect(next.selectedEntryId).toBe('maren');
  });

  it('returns the same state for an entry that does not exist', () => {
    const state = stateOf([MAREN]);

    expect(softDeleteEntryInState(state, 'ghost')).toBe(state);
  });
});

describe('restoreEntryInState', () => {
  it('puts a deleted entry back at the end of its shelf', () => {
    const deleted = softDeleteEntryInState(stateOf([MAREN, TOBIN]), 'maren');

    const next = restoreEntryInState(deleted, MAREN);

    expect(next.byId.maren).toEqual(MAREN);
    expect(next.order.people).toEqual(['tobin', 'maren']);
  });

  it('does not list an entry twice when it is already on the shelf', () => {
    const next = restoreEntryInState(stateOf([MAREN]), MAREN);

    expect(next.order.people).toEqual(['maren']);
  });
});
