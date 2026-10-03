import { describe, expect, it, vi } from 'vitest';

import type { ResearchTurnWithCards } from '@/domain/types';
import { readResearchStream, type ByteReader, type StreamHandlers } from './readStream';

const encoder = new TextEncoder();

/** A reader that yields the given byte chunks, then signals the end. */
function readerOf(chunks: Uint8Array[]): ByteReader {
  const queue = [...chunks];
  return {
    read: async () => {
      const value = queue.shift();
      return value ? { done: false, value } : { done: true };
    },
  };
}

const readerOfText = (...chunks: string[]) => readerOf(chunks.map((c) => encoder.encode(c)));

function handlers() {
  return {
    onDelta: vi.fn<StreamHandlers['onDelta']>(),
    onDone: vi.fn<StreamHandlers['onDone']>(),
    onError: vi.fn<StreamHandlers['onError']>(),
  };
}

const TURN: ResearchTurnWithCards = {
  id: 't1',
  threadId: 'thread',
  ordinal: 0,
  side: 'them',
  who: 'AI',
  text: 'The keeper.',
  cards: [],
};

describe('readResearchStream', () => {
  it('hands each delta to onDelta, in order', async () => {
    const h = handlers();

    await readResearchStream(
      readerOfText('{"type":"delta","text":"The "}\n{"type":"delta","text":"keeper"}\n'),
      h,
    );

    expect(h.onDelta.mock.calls).toEqual([['The '], ['keeper']]);
  });

  it('hands the saved turns to onDone', async () => {
    const h = handlers();

    await readResearchStream(readerOfText(`${JSON.stringify({ type: 'done', turns: [TURN] })}\n`), h);

    expect(h.onDone).toHaveBeenCalledWith([TURN]);
  });

  it('hands a server error to onError', async () => {
    const h = handlers();

    await readResearchStream(readerOfText('{"type":"error","error":"Gateway down"}\n'), h);

    expect(h.onError).toHaveBeenCalledWith('Gateway down');
  });

  it('reassembles a frame that arrives split across chunks', async () => {
    const h = handlers();

    await readResearchStream(readerOfText('{"type":"del', 'ta","text":"keeper"}\n'), h);

    expect(h.onDelta).toHaveBeenCalledWith('keeper');
  });

  it('reassembles a multi-byte character split across chunks', async () => {
    const h = handlers();
    const bytes = encoder.encode('{"type":"delta","text":"“"}\n');
    const cut = bytes.indexOf(0xe2) + 1;

    await readResearchStream(readerOf([bytes.slice(0, cut), bytes.slice(cut)]), h);

    expect(h.onDelta).toHaveBeenCalledWith('“');
  });

  it('reads a final frame that has no trailing newline', async () => {
    const h = handlers();

    await readResearchStream(readerOfText('{"type":"delta","text":"last"}'), h);

    expect(h.onDelta).toHaveBeenCalledWith('last');
  });

  it('skips blank lines and lines that are not JSON, and keeps reading', async () => {
    const h = handlers();

    await readResearchStream(readerOfText('\n  \nnot json\n{"type":"delta","text":"ok"}\n'), h);

    expect(h.onDelta.mock.calls).toEqual([['ok']]);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('calls nothing for an empty stream', async () => {
    const h = handlers();

    await readResearchStream(readerOf([]), h);

    expect(h.onDelta).not.toHaveBeenCalled();
    expect(h.onDone).not.toHaveBeenCalled();
    expect(h.onError).not.toHaveBeenCalled();
  });
});
