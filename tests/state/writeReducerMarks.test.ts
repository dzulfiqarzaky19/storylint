import { describe, it, expect } from 'vitest';
import { initWriteState, writeReducer } from '@/lib/state/writeStore';
import type { Mark } from '@/lib/check';

// The reducer owns local mark suppression. These lock the two dismiss-related
// guarantees the live E2E surfaced: clicking "leave"/"not now" clears the
// underline immediately (not on the next check pass), and a re-emitted resolved
// mark never reappears.
function mark(markKey: string, quote: string): Mark {
  return {
    markKey,
    kind: 'conflict',
    ruleId: 'r',
    quote,
    rail: 'rail',
    noteText: 'note',
    actions: [],
    position: { paragraphIndex: 0, occurrenceIndex: 0 },
  };
}

const base = () =>
  initWriteState({
    chapterNumber: 7,
    body: {},
    marks: [mark('a', 'one'), mark('b', 'two')],
  });

describe('writeReducer mark suppression', () => {
  it('RESOLVE_MARK leave drops the mark immediately and records the key', () => {
    const next = writeReducer(base(), {
      type: 'RESOLVE_MARK',
      markKey: 'a',
      actionId: 'leave',
    });
    expect(next.marks.map((m) => m.markKey)).toEqual(['b']);
    expect(next.resolvedMarkKeys).toContain('a');
  });

  it('RESOLVE_MARK leave closes the note when the resolved mark was open', () => {
    const opened = writeReducer(base(), { type: 'OPEN_MARK', markKey: 'a' });
    expect(opened.openMarkKey).toBe('a');
    const next = writeReducer(opened, {
      type: 'RESOLVE_MARK',
      markKey: 'a',
      actionId: 'leave',
    });
    expect(next.openMarkKey).toBeNull();
  });

  it('wiki/text resolutions do NOT drop the mark (handled elsewhere)', () => {
    const wiki = writeReducer(base(), {
      type: 'RESOLVE_MARK',
      markKey: 'a',
      actionId: 'wiki',
    });
    expect(wiki.marks.map((m) => m.markKey)).toEqual(['a', 'b']);
    const text = writeReducer(base(), {
      type: 'RESOLVE_MARK',
      markKey: 'a',
      actionId: 'text',
    });
    expect(text.marks.map((m) => m.markKey)).toEqual(['a', 'b']);
  });

  it('SET_MARKS filters out already-resolved marks (re-emit guard)', () => {
    const resolved = writeReducer(base(), {
      type: 'RESOLVE_MARK',
      markKey: 'a',
      actionId: 'leave',
    });
    // A later check pass re-emits BOTH marks; the resolved one must stay gone.
    const next = writeReducer(resolved, {
      type: 'SET_MARKS',
      marks: [mark('a', 'one'), mark('b', 'two')],
    });
    expect(next.marks.map((m) => m.markKey)).toEqual(['b']);
  });
});
