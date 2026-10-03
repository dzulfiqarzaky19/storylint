import { describe, expect, it } from 'vitest';

import { snapshotEntry } from '@/domain/testing/snapshot';
import {
  addSuggestionAsFactInState,
  createFactInState,
  deleteFactInState,
  editFactInState,
  moveFactInState,
} from './facts';
import { stateOf, suggestion } from './testing/state';

const MAREN = snapshotEntry('maren', 'Maren Vale', { facts: { Eyes: 'Grey', Age: 'Fourteen' } });
const TOBIN = snapshotEntry('tobin', 'Tobin Ash', { facts: { Eyes: 'Brown' } });

function factKeys(state: ReturnType<typeof stateOf>, entryId: string): string[] {
  return (state.byId[entryId]?.facts ?? []).map((f) => f.key);
}

describe('moveFactInState', () => {
  it('moves the fact to the end of the other entry and re-homes it', () => {
    const next = moveFactInState(stateOf([MAREN, TOBIN]), 'maren.Age', 'maren', 'tobin');

    expect(factKeys(next, 'maren')).toEqual(['Eyes']);
    expect(factKeys(next, 'tobin')).toEqual(['Eyes', 'Age']);
    expect(next.byId.tobin?.facts[1]).toMatchObject({ id: 'maren.Age', entryId: 'tobin', sortOrder: 1 });
  });

  it.each([
    ['the source and target are the same entry', 'maren.Age', 'maren', 'maren'],
    ['the source entry does not exist', 'maren.Age', 'ghost', 'tobin'],
    ['the target entry does not exist', 'maren.Age', 'maren', 'ghost'],
    ['the fact is not on the source entry', 'tobin.Eyes', 'maren', 'tobin'],
  ])('returns the same state when %s', (_name, factId, from, to) => {
    const state = stateOf([MAREN, TOBIN]);

    expect(moveFactInState(state, factId, from, to)).toBe(state);
  });
});

describe('addSuggestionAsFactInState', () => {
  const ACCEPT = {
    suggestionKey: 's1',
    entryId: 'maren',
    factId: 'f-new',
    key: 'Carries',
    value: 'A brass ring',
    sortOrder: 2,
  };

  it('adds the suggestion as a fresh fact and removes it from the suggestions', () => {
    const state = stateOf([MAREN], { suggestions: [suggestion('s1', 'maren'), suggestion('s2', 'maren')] });

    const next = addSuggestionAsFactInState(state, ACCEPT);

    expect(next.byId.maren?.facts.at(-1)).toEqual({
      id: 'f-new',
      entryId: 'maren',
      key: 'Carries',
      value: 'A brass ring',
      fresh: true,
      sortOrder: 2,
    });
    expect(next.suggestions.map((s) => s.suggestionKey)).toEqual(['s2']);
  });

  it('still removes the suggestion when its entry no longer exists', () => {
    const state = stateOf([MAREN], { suggestions: [suggestion('s1', 'ghost')] });

    const next = addSuggestionAsFactInState(state, { ...ACCEPT, entryId: 'ghost' });

    expect(next.suggestions).toEqual([]);
    expect(next.byId).toEqual(state.byId);
  });
});

describe('editFactInState', () => {
  it('changes the value and keeps the key when only a value is given', () => {
    const next = editFactInState(stateOf([MAREN]), { entryId: 'maren', factId: 'maren.Eyes', value: 'Green' });

    expect(next.byId.maren?.facts[0]).toMatchObject({ key: 'Eyes', value: 'Green' });
  });

  it('changes the key and keeps the value when only a key is given', () => {
    const next = editFactInState(stateOf([MAREN]), { entryId: 'maren', factId: 'maren.Eyes', key: 'Eye colour' });

    expect(next.byId.maren?.facts[0]).toMatchObject({ key: 'Eye colour', value: 'Grey' });
  });

  it('leaves the other facts of the entry alone', () => {
    const next = editFactInState(stateOf([MAREN]), { entryId: 'maren', factId: 'maren.Eyes', value: 'Green' });

    expect(next.byId.maren?.facts[1]).toEqual(MAREN.facts[1]);
  });

  it.each([
    ['the entry does not exist', 'ghost', 'maren.Eyes'],
    ['the fact does not exist', 'maren', 'ghost'],
  ])('returns the same state when %s', (_name, entryId, factId) => {
    const state = stateOf([MAREN]);

    expect(editFactInState(state, { entryId, factId, value: 'x' })).toBe(state);
  });
});

describe('createFactInState', () => {
  const NEW_FACT = { entryId: 'maren', factId: 'f-new', key: 'Hair', value: 'Black', sortOrder: 2 };

  it('appends a fresh fact to the entry', () => {
    const next = createFactInState(stateOf([MAREN]), NEW_FACT);

    expect(factKeys(next, 'maren')).toEqual(['Eyes', 'Age', 'Hair']);
    expect(next.byId.maren?.facts.at(-1)).toMatchObject({ id: 'f-new', fresh: true, sortOrder: 2 });
  });

  it('returns the same state for an entry that does not exist', () => {
    const state = stateOf([MAREN]);

    expect(createFactInState(state, { ...NEW_FACT, entryId: 'ghost' })).toBe(state);
  });
});

describe('deleteFactInState', () => {
  it('removes the fact from the entry', () => {
    const next = deleteFactInState(stateOf([MAREN]), 'maren', 'maren.Eyes');

    expect(factKeys(next, 'maren')).toEqual(['Age']);
  });

  it.each([
    ['the entry does not exist', 'ghost', 'maren.Eyes'],
    ['the fact does not exist', 'maren', 'ghost'],
  ])('returns the same state when %s', (_name, entryId, factId) => {
    const state = stateOf([MAREN]);

    expect(deleteFactInState(state, entryId, factId)).toBe(state);
  });
});
