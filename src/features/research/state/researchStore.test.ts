import { describe, expect, it } from 'vitest';

import { deepFreeze } from '@/domain/testing/freeze';
import type { ResearchProposition, ResearchTurnWithCards } from '@/domain/types';
import { initResearchState, researchReducer, type ResearchState } from './researchStore';

function card(id: string, flags: { kept?: boolean; inWiki?: boolean } = {}): ResearchProposition {
  return {
    id,
    turnId: 't1',
    kind: 'fact',
    title: id,
    body: '',
    asKind: 'lore',
    sortOrder: 0,
    kept: flags.kept ?? false,
    inWiki: flags.inWiki ?? false,
  };
}

function turn(id: string, text = '', cards: ResearchProposition[] = []): ResearchTurnWithCards {
  return { id, threadId: 'thread', ordinal: 0, side: 'them', who: 'AI', text, cards };
}

/** A frozen state: any mutation by the reducer throws. */
function stateOf(turns: ResearchTurnWithCards[], over: Partial<ResearchState> = {}): ResearchState {
  return deepFreeze({
    ...initResearchState({
      question: 'Who keeps the light?',
      turns,
      initialVisibleTurnIds: turns.map((t) => t.id),
    }),
    ...over,
  });
}

describe('initResearchState', () => {
  it('collects the kept and in-wiki cards from the loaded turns', () => {
    const state = initResearchState({
      question: 'Who keeps the light?',
      turns: [turn('t1', '', [card('a', { kept: true }), card('b', { kept: true, inWiki: true }), card('c')])],
      initialVisibleTurnIds: ['t1'],
    });

    expect(state.keptIds).toEqual(['a', 'b']);
    expect(state.inWikiIds).toEqual(['b']);
  });

  it('starts with nothing pending and no error', () => {
    const state = initResearchState({ question: 'q', turns: [], initialVisibleTurnIds: [] });

    expect(state).toMatchObject({ question: 'q', pendingPropositionId: null, error: null });
  });
});

describe('researchReducer', () => {
  describe('KEEP_CARD', () => {
    it('keeps a card', () => {
      const next = researchReducer(stateOf([]), { type: 'KEEP_CARD', propositionId: 'a', kept: true });

      expect(next.keptIds).toEqual(['a']);
    });

    it('keeps a card only once', () => {
      const state = stateOf([], { keptIds: ['a'] });

      const next = researchReducer(state, { type: 'KEEP_CARD', propositionId: 'a', kept: true });

      expect(next.keptIds).toEqual(['a']);
    });

    it('un-keeps a card', () => {
      const state = stateOf([], { keptIds: ['a', 'b'] });

      const next = researchReducer(state, { type: 'KEEP_CARD', propositionId: 'a', kept: false });

      expect(next.keptIds).toEqual(['b']);
    });
  });

  describe('proposing a card for the wiki', () => {
    it('marks the proposed card as pending', () => {
      const next = researchReducer(stateOf([]), { type: 'PROPOSE_CARD', propositionId: 'a' });

      expect(next.pendingPropositionId).toBe('a');
    });

    it('clears the pending card on cancel', () => {
      const state = stateOf([], { pendingPropositionId: 'a' });

      expect(researchReducer(state, { type: 'CANCEL_PENDING' }).pendingPropositionId).toBeNull();
    });

    it('records a confirmed card as in the wiki and kept, and clears it from pending', () => {
      const state = stateOf([], { pendingPropositionId: 'a' });

      const next = researchReducer(state, { type: 'CONFIRM_CARD', propositionId: 'a' });

      expect(next).toMatchObject({ inWikiIds: ['a'], keptIds: ['a'], pendingPropositionId: null });
    });

    it('leaves a different pending card pending when another is confirmed', () => {
      const state = stateOf([], { pendingPropositionId: 'b' });

      const next = researchReducer(state, { type: 'CONFIRM_CARD', propositionId: 'a' });

      expect(next.pendingPropositionId).toBe('b');
    });
  });

  describe('APPEND_TURN', () => {
    it('appends the turns, shows them, and clears the error', () => {
      const state = stateOf([turn('t1')], { error: 'Network down' });

      const next = researchReducer(state, { type: 'APPEND_TURN', turns: [turn('t2'), turn('t3')] });

      expect(next.turns.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
      expect(next.visibleTurnIds).toEqual(['t1', 't2', 't3']);
      expect(next.error).toBeNull();
    });

    it('picks up the kept and in-wiki flags of the new cards', () => {
      const next = researchReducer(stateOf([]), {
        type: 'APPEND_TURN',
        turns: [turn('t1', '', [card('a', { kept: true }), card('b', { inWiki: true })])],
      });

      expect(next).toMatchObject({ keptIds: ['a'], inWikiIds: ['b'] });
    });
  });

  describe('a streaming turn', () => {
    it('appends the placeholder turns, shows them, and clears the error', () => {
      const state = stateOf([turn('t1')], { error: 'Network down' });

      const next = researchReducer(state, { type: 'APPEND_STREAMING_TURN', turns: [turn('tmp')] });

      expect(next.turns.map((t) => t.id)).toEqual(['t1', 'tmp']);
      expect(next.visibleTurnIds).toEqual(['t1', 'tmp']);
      expect(next.error).toBeNull();
    });

    it('appends each delta to the streaming turn only', () => {
      const state = stateOf([turn('t1', 'Done.'), turn('tmp', 'The ')]);

      const next = researchReducer(state, { type: 'STREAM_DELTA', turnId: 'tmp', text: 'keeper' });

      expect(next.turns.map((t) => t.text)).toEqual(['Done.', 'The keeper']);
    });

    it('swaps the placeholder for the saved turn, in place', () => {
      const state = stateOf([turn('tmp', 'The keeper'), turn('t9')]);
      const saved = turn('t2', 'The keeper.', [card('a', { kept: true, inWiki: true })]);

      const next = researchReducer(state, { type: 'RECONCILE_TURN', tempTurnId: 'tmp', turn: saved });

      expect(next.turns).toEqual([saved, turn('t9')]);
      expect(next.visibleTurnIds).toEqual(['t2', 't9']);
      expect(next).toMatchObject({ keptIds: ['a'], inWikiIds: ['a'] });
    });

    it('removes the placeholder turns on rollback', () => {
      const state = stateOf([turn('t1'), turn('tmp-you'), turn('tmp-them')]);

      const next = researchReducer(state, {
        type: 'ROLLBACK_STREAMING_TURN',
        turnIds: ['tmp-you', 'tmp-them'],
      });

      expect(next.turns.map((t) => t.id)).toEqual(['t1']);
      expect(next.visibleTurnIds).toEqual(['t1']);
    });
  });

  it('sets and clears the error', () => {
    const failed = researchReducer(stateOf([]), { type: 'SET_ERROR', error: 'Save failed' });
    expect(failed.error).toBe('Save failed');

    expect(researchReducer(failed, { type: 'SET_ERROR', error: null }).error).toBeNull();
  });
});
