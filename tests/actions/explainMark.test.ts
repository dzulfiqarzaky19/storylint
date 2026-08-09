/**
 * explainMark server action (HANDOFF section 8, Tier 3 — AI meaning layer).
 *
 * explainMark is the ON-CLICK half of the write-page check: when the engine flags
 * a run, the writer can ask the AI to explain WHY it clashes and offer an optional
 * rewrite. It is READ-ONLY (writes nothing) and grounds on a retrieved subset of
 * the wiki, not the whole world (scale G1/G4).
 *
 * These tests lock the action's orchestration without a network or database:
 *   - the aiEnabled() gate (graceful "AI off"),
 *   - the happy path (JSON advice passed through, trimmed),
 *   - the G5 fallback: when the JSON call throws (already billed), the action does
 *     NOT make a second AI call; it degrades for free to the engine's noteText.
 *   - retrieval prunes the grounded gazetteer to entities the flagged text mentions.
 *
 * The gateway (completeJson/complete) and the wiki read (loadWikiSnapshot) are
 * mocked; the action's own logic runs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const completeJson = vi.fn();
const complete = vi.fn();
const aiEnabled = vi.fn(() => true);
vi.mock('@/lib/ai/saarouters', () => ({
  completeJson: (opts: unknown) => completeJson(opts),
  complete: (opts: unknown) => complete(opts),
  aiEnabled: () => aiEnabled(),
}));

interface MockEntry {
  id: string;
  name: string;
  kind: string;
  summary: string;
  facts: Array<{ key: string; value: string }>;
  ties: Array<{ toEntryId: string }>;
}
interface MockWiki {
  entries: MockEntry[];
  byId: Record<string, MockEntry>;
}
const key: MockEntry = {
  id: 'ironkey',
  name: 'Iron Key',
  kind: 'object',
  summary: 'A cold heirloom.',
  facts: [{ key: 'metal', value: 'black iron' }],
  ties: [],
};
const dragon: MockEntry = {
  id: 'dragon',
  name: 'Dragon of Vantram',
  kind: 'creature',
  summary: 'Sleeps under the mountain.',
  facts: [],
  ties: [],
};
const loadWikiSnapshot = vi.fn(
  async (): Promise<MockWiki> => ({
    entries: [key, dragon],
    byId: { ironkey: key, dragon },
  }),
);
vi.mock('@/lib/db/queries', () => ({
  loadWikiSnapshot: () => loadWikiSnapshot(),
}));

// write.ts imports the mutation layer at module scope; stub so the module loads.
vi.mock('@/lib/db/mutations', () => ({
  saveChapterBody: vi.fn(),
  replacePhraseMentions: vi.fn(),
  upsertResolvedMark: vi.fn(),
  insertChapter: vi.fn(),
  getNextChapterNumber: vi.fn(),
}));

import { explainMark } from '@/lib/actions/write';

const baseInput = {
  quote: 'a brass key',
  kind: 'conflict' as const,
  noteText: 'The Iron Key is black iron, not brass.',
  paragraph: 'She turned a brass key, the Iron Key of her house, in the lock.',
  sentence: 'She turned a brass key, the Iron Key of her house, in the lock.',
};

/** Read the request handed to the (mocked) JSON gateway. */
function lastJsonUser(): string {
  const opts = completeJson.mock.calls.at(-1)?.[0] as {
    messages: Array<{ content: string }>;
  };
  return opts.messages[0]!.content;
}

beforeEach(() => {
  completeJson.mockReset();
  complete.mockReset();
  aiEnabled.mockReset();
  aiEnabled.mockReturnValue(true);
  loadWikiSnapshot.mockClear();
});

describe('explainMark — gate', () => {
  it('returns a typed error and reads nothing when AI is off', async () => {
    aiEnabled.mockReturnValue(false);
    const res = await explainMark(baseInput);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected failure');
    expect(res.error).toMatch(/not configured/i);
    expect(completeJson).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    expect(loadWikiSnapshot).not.toHaveBeenCalled();
  });

  it('returns a typed error when there is no quote', async () => {
    const res = await explainMark({ ...baseInput, quote: '   ' });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected failure');
    expect(completeJson).not.toHaveBeenCalled();
  });
});

describe('explainMark — happy path', () => {
  it('passes through the JSON advice (trimmed) and never uses the fallback', async () => {
    completeJson.mockResolvedValueOnce({
      explanation: '  It clashes: the key is black iron.  ',
      rewrite: '  an iron key  ',
    });
    const res = await explainMark(baseInput);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.explanation).toBe('It clashes: the key is black iron.');
    expect(res.data.rewrite).toBe('an iron key');
    // The single JSON call is the only AI spend on the happy path.
    expect(completeJson).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe('explainMark — G5 fallback (no double-bill)', () => {
  it('degrades to the engine noteText and makes NO second AI call when JSON throws', async () => {
    completeJson.mockRejectedValueOnce(new Error('bad json'));
    const res = await explainMark(baseInput);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    // Free degrade: the engine's own note, no rewrite.
    expect(res.data.explanation).toBe(baseInput.noteText);
    expect(res.data.rewrite).toBe('');
    // The whole point of G5: the failed JSON call already billed; we must NOT
    // make a second full AI call here.
    expect(complete).not.toHaveBeenCalled();
    expect(completeJson).toHaveBeenCalledTimes(1);
  });
});

describe('explainMark — retrieval prunes the grounded gazetteer (scale G1)', () => {
  it('grounds only on entities the flagged text mentions, not the whole wiki', async () => {
    completeJson.mockResolvedValueOnce({ explanation: 'x', rewrite: '' });
    const res = await explainMark(baseInput);
    expect(res.ok).toBe(true);
    const user = lastJsonUser();
    // "Iron Key" is named in the paragraph -> grounded; the unrelated dragon is not.
    expect(user).toContain('Iron Key');
    expect(user).not.toContain('Dragon of Vantram');
  });
});
