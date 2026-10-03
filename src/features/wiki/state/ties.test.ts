import { describe, expect, it } from 'vitest';

import { snapshotEntry } from '@/domain/testing/snapshot';
import { stateOf } from './testing/state';
import { createTiedInState, linkEntryInState, untieInState } from './ties';

const MAREN = snapshotEntry('maren', 'Maren Vale');
const LIGHT = snapshotEntry('light', 'Verge Light', { kind: 'world' });

const LINK = { tieId: 't1', fromEntryId: 'maren', toEntryId: 'light', rel: 'keeps' };

describe('linkEntryInState', () => {
  it('adds a tie on the source entry, described by the target it points at', () => {
    const next = linkEntryInState(stateOf([MAREN, LIGHT]), LINK);

    expect(next.byId.maren?.ties).toEqual([
      {
        id: 't1',
        fromEntryId: 'maren',
        toEntryId: 'light',
        rel: 'keeps',
        toName: 'Verge Light',
        toKind: 'world',
        toCatalogueNo: 'LIGHT',
      },
    ]);
  });

  it('leaves the target entry without a tie back', () => {
    const next = linkEntryInState(stateOf([MAREN, LIGHT]), LINK);

    expect(next.byId.light?.ties).toEqual([]);
  });

  it('allows a second tie to the same entry under a different relation', () => {
    const once = linkEntryInState(stateOf([MAREN, LIGHT]), LINK);

    const twice = linkEntryInState(once, { ...LINK, tieId: 't2', rel: 'was born at' });

    expect(twice.byId.maren?.ties.map((t) => t.rel)).toEqual(['keeps', 'was born at']);
  });

  it('returns the same state for a tie that already exists', () => {
    const once = linkEntryInState(stateOf([MAREN, LIGHT]), LINK);

    expect(linkEntryInState(once, { ...LINK, tieId: 't2' })).toBe(once);
  });

  it.each([
    ['the source entry does not exist', { ...LINK, fromEntryId: 'ghost' }],
    ['the target entry does not exist', { ...LINK, toEntryId: 'ghost' }],
  ])('returns the same state when %s', (_name, action) => {
    const state = stateOf([MAREN, LIGHT]);

    expect(linkEntryInState(state, action)).toBe(state);
  });
});

describe('untieInState', () => {
  const TIED = snapshotEntry('maren', 'Maren Vale', { ties: ['light'] });

  it('removes the tie from the entry', () => {
    const next = untieInState(stateOf([TIED, LIGHT]), 'maren', 'maren>light');

    expect(next.byId.maren?.ties).toEqual([]);
  });

  it.each([
    ['the entry does not exist', 'ghost', 'maren>light'],
    ['the tie does not exist', 'maren', 'ghost'],
  ])('returns the same state when %s', (_name, entryId, tieId) => {
    const state = stateOf([TIED, LIGHT]);

    expect(untieInState(state, entryId, tieId)).toBe(state);
  });
});

describe('createTiedInState', () => {
  const CREATE = {
    entryId: 'osk',
    tieId: 't1',
    kind: 'lore',
    shelf: 'lore',
    name: 'Saint Osk',
    toEntryId: 'maren',
    rel: 'prays to',
  } as const;

  it('creates the new entry, selects it, and ties the existing entry to it', () => {
    const next = createTiedInState(stateOf([MAREN]), CREATE);

    expect(next.byId.osk).toMatchObject({ name: 'Saint Osk', kind: 'lore', shelf: 'lore' });
    expect(next.order.lore).toEqual(['osk']);
    expect(next.selectedEntryId).toBe('osk');
    expect(next.byId.maren?.ties).toMatchObject([
      { id: 't1', toEntryId: 'osk', rel: 'prays to', toName: 'Saint Osk' },
    ]);
  });

  it('still creates the entry when the entry to tie it to does not exist', () => {
    const next = createTiedInState(stateOf([MAREN]), { ...CREATE, toEntryId: 'ghost' });

    expect(next.byId.osk?.name).toBe('Saint Osk');
    expect(next.byId.maren?.ties).toEqual([]);
  });
});
