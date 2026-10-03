import { describe, expect, it } from 'vitest';

import { mark } from '@/domain/check/testing/wiki';
import { deepFreeze } from '@/domain/testing/freeze';
import { initWriteState, writeReducer, type WriteState } from './writeStore';

/** A frozen state: any mutation by the reducer throws. */
function stateOf(over: Partial<WriteState> = {}): WriteState {
  return deepFreeze({ ...initWriteState({ chapterNumber: 1, body: { type: 'doc' } }), ...over });
}

describe('initWriteState', () => {
  it('starts clean, with no marks, nothing open and no error', () => {
    expect(initWriteState({ chapterNumber: 3, body: 'b' })).toEqual({
      chapterNumber: 3,
      body: 'b',
      marks: [],
      openMarkKey: null,
      resolvedMarkKeys: [],
      dirty: false,
      error: null,
    });
  });

  it('takes the marks and resolved keys it is given', () => {
    const marks = [mark({ markKey: 'm1' })];

    const state = initWriteState({ chapterNumber: 1, body: null, marks, resolvedMarkKeys: ['r1'] });

    expect(state).toMatchObject({ marks, resolvedMarkKeys: ['r1'] });
  });
});

describe('writeReducer', () => {
  it('stores an edited body and marks the chapter dirty', () => {
    const next = writeReducer(stateOf(), { type: 'EDIT_BODY', body: 'new' });

    expect(next).toMatchObject({ body: 'new', dirty: true });
  });

  it('clears dirty and the error once a save succeeds', () => {
    const state = stateOf({ dirty: true, error: 'Save failed' });

    expect(writeReducer(state, { type: 'SAVE_SUCCEEDED' })).toMatchObject({ dirty: false, error: null });
  });

  it('keeps the chapter dirty while a save is only requested', () => {
    const state = stateOf({ dirty: true });

    expect(writeReducer(state, { type: 'SAVE_MANUSCRIPT' })).toBe(state);
  });

  it('replaces the marks, leaving out any the writer already resolved', () => {
    const state = stateOf({ resolvedMarkKeys: ['m2'] });

    const next = writeReducer(state, {
      type: 'SET_MARKS',
      marks: [mark({ markKey: 'm1' }), mark({ markKey: 'm2' })],
    });

    expect(next.marks.map((m) => m.markKey)).toEqual(['m1']);
  });

  describe('OPEN_MARK', () => {
    it('opens a mark', () => {
      expect(writeReducer(stateOf(), { type: 'OPEN_MARK', markKey: 'm1' }).openMarkKey).toBe('m1');
    });

    it('switches to another mark', () => {
      const state = stateOf({ openMarkKey: 'm1' });

      expect(writeReducer(state, { type: 'OPEN_MARK', markKey: 'm2' }).openMarkKey).toBe('m2');
    });

    it('closes the mark when the open one is chosen again', () => {
      const state = stateOf({ openMarkKey: 'm1' });

      expect(writeReducer(state, { type: 'OPEN_MARK', markKey: 'm1' }).openMarkKey).toBeNull();
    });

    it('closes the open mark when given no key', () => {
      const state = stateOf({ openMarkKey: 'm1' });

      expect(writeReducer(state, { type: 'OPEN_MARK', markKey: null }).openMarkKey).toBeNull();
    });
  });

  describe('RESOLVE_MARK', () => {
    const MARKS = [mark({ markKey: 'm1' }), mark({ markKey: 'm2' })];

    it('dismisses a mark left as is: removes it, remembers it, and closes it', () => {
      const state = stateOf({ marks: MARKS, openMarkKey: 'm1' });

      const next = writeReducer(state, { type: 'RESOLVE_MARK', markKey: 'm1', actionId: 'leave' });

      expect(next.marks.map((m) => m.markKey)).toEqual(['m2']);
      expect(next.resolvedMarkKeys).toEqual(['m1']);
      expect(next.openMarkKey).toBeNull();
    });

    it('keeps a different mark open', () => {
      const state = stateOf({ marks: MARKS, openMarkKey: 'm2' });

      const next = writeReducer(state, { type: 'RESOLVE_MARK', markKey: 'm1', actionId: 'leave' });

      expect(next.openMarkKey).toBe('m2');
    });

    it('remembers a dismissed mark only once', () => {
      const state = stateOf({ marks: MARKS, resolvedMarkKeys: ['m1'] });

      const next = writeReducer(state, { type: 'RESOLVE_MARK', markKey: 'm1', actionId: 'leave' });

      expect(next.resolvedMarkKeys).toEqual(['m1']);
    });

    it.each(['wiki', 'text'] as const)(
      'leaves the state alone for "%s", which resolves through the wiki or the editor',
      (actionId) => {
        const state = stateOf({ marks: MARKS, openMarkKey: 'm1' });

        expect(writeReducer(state, { type: 'RESOLVE_MARK', markKey: 'm1', actionId })).toBe(state);
      },
    );
  });

  it('sets and clears the error', () => {
    const failed = writeReducer(stateOf(), { type: 'SET_ERROR', error: 'Save failed' });
    expect(failed.error).toBe('Save failed');

    expect(writeReducer(failed, { type: 'SET_ERROR', error: null }).error).toBeNull();
  });
});
