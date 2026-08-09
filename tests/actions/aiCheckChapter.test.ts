/**
 * aiCheckChapter server action (HANDOFF section 8, Tier 3 — AI meaning layer).
 *
 * aiCheckChapter is the ON-DEMAND (save-time) half of the write-page check: it
 * asks the AI to cross-check the manuscript against the wiki and returns marks in
 * the SAME shape the deterministic engine emits. It writes NOTHING (PRODUCT RULE
 * 1): findings route through resolveMark's confirmation path.
 *
 * These tests lock the action's own ORCHESTRATION without a network or database:
 *   - the aiEnabled() gate (graceful "AI off"),
 *   - which paragraph indices are sent (empty changedIndices => all; out-of-range
 *     dropped; deduped),
 *   - the resolvedMarkKeys suppression filter,
 *   - the preferredIndexByQuote hint built from the model's echoed paragraph
 *     numbers (disambiguates identical substrings across paragraphs),
 *   - typed-error (never throw) when the gateway fails.
 *
 * The gateway (completeJson) and the wiki read (loadWikiSnapshot) are mocked; the
 * REAL pure adapter (aiResultToMarks) runs, so the grounding guard is exercised
 * end to end through the action.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Gateway + config: mocked so no live SaaRouters call is made. `completeJson`
// returns whatever AiCheckResponse a test queues; `aiEnabled` gates the action.
const completeJson = vi.fn();
const aiEnabled = vi.fn(() => true);
vi.mock('@/lib/ai/saarouters', () => ({
  completeJson: (opts: unknown) => completeJson(opts),
  aiEnabled: () => aiEnabled(),
  // explainMark (a sibling in the same module) imports these; stub so the module
  // loads. aiCheckChapter itself never calls them.
  complete: vi.fn(),
}));

// Wiki read: mocked to a tiny gazetteer so the action builds its prompt without a
// database. The exact text is irrelevant to these tests (the model is mocked).
const loadWikiSnapshot = vi.fn(async () => ({
  entries: [
    {
      id: 'sept',
      name: 'The Quiet Sept',
      kind: 'faction',
      summary: 'A hidden order.',
      facts: [{ key: 'members', value: 'Twenty-one, never more' }],
    },
  ],
}));
vi.mock('@/lib/db/queries', () => ({
  loadWikiSnapshot: () => loadWikiSnapshot(),
}));

// write.ts imports the mutation layer at module scope; stub it so the module
// loads. aiCheckChapter touches none of these.
vi.mock('@/lib/db/mutations', () => ({
  saveChapterBody: vi.fn(),
  replacePhraseMentions: vi.fn(),
  upsertResolvedMark: vi.fn(),
  insertChapter: vi.fn(),
  getNextChapterNumber: vi.fn(),
}));

import { aiCheckChapter } from '@/lib/actions/write';
import { AI_CONFLICT_RULE_ID, AI_MISSING_RULE_ID } from '@/lib/check/ai';

// A two-paragraph manuscript with a grounded conflict quote in P0 and a missing
// quote in P1. Both quotes are VERBATIM substrings, so the grounding guard keeps
// them; a fabricated quote would be dropped.
const paragraphs = [
  'The Sept had twenty-three members that winter, never more.',
  'She wore her grandmother\u2019s iron key on a cord.',
];

/** Read the request the action handed the (mocked) gateway. */
function lastPromptUser(): string {
  const opts = completeJson.mock.calls.at(-1)?.[0] as {
    messages: Array<{ content: string }>;
  };
  return opts.messages[0]!.content;
}

beforeEach(() => {
  completeJson.mockReset();
  aiEnabled.mockReset();
  aiEnabled.mockReturnValue(true);
  loadWikiSnapshot.mockClear();
});

describe('aiCheckChapter — gate', () => {
  it('returns a typed error and never calls the gateway when AI is off', async () => {
    aiEnabled.mockReturnValue(false);
    const res = await aiCheckChapter({ paragraphs });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected failure');
    expect(res.error).toMatch(/not configured/i);
    expect(completeJson).not.toHaveBeenCalled();
    // No wiki read either — the gate short-circuits before any I/O.
    expect(loadWikiSnapshot).not.toHaveBeenCalled();
  });
});

describe('aiCheckChapter — which paragraphs are sent', () => {
  it('checks ALL paragraphs when changedIndices is omitted', async () => {
    completeJson.mockResolvedValueOnce({ conflicts: [], missing: [] });
    const res = await aiCheckChapter({ paragraphs });
    expect(res.ok).toBe(true);
    const user = lastPromptUser();
    // Both paragraph markers present => both were sent.
    expect(user).toContain('[[P0]]');
    expect(user).toContain('[[P1]]');
  });

  it('sends ONLY the changed paragraph when changedIndices narrows it', async () => {
    completeJson.mockResolvedValueOnce({ conflicts: [], missing: [] });
    const res = await aiCheckChapter({ paragraphs, changedIndices: [1] });
    expect(res.ok).toBe(true);
    const user = lastPromptUser();
    expect(user).not.toContain('[[P0]]');
    expect(user).toContain('[[P1]]');
  });

  it('drops out-of-range and duplicate indices before sending', async () => {
    completeJson.mockResolvedValueOnce({ conflicts: [], missing: [] });
    // 1 twice (dedup), 9 is past the end (dropped), -1 is invalid (dropped).
    const res = await aiCheckChapter({
      paragraphs,
      changedIndices: [1, 1, 9, -1],
    });
    expect(res.ok).toBe(true);
    const user = lastPromptUser();
    expect(user).not.toContain('[[P0]]');
    expect(user).toContain('[[P1]]');
    expect(user).not.toContain('[[P9]]');
    // P1 appears exactly once despite the duplicate index.
    expect(user.match(/\[\[P1\]\]/g)).toHaveLength(1);
  });

  it('returns no marks and never calls the gateway when no valid indices remain', async () => {
    const res = await aiCheckChapter({ paragraphs, changedIndices: [9, -1] });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.marks).toEqual([]);
    expect(completeJson).not.toHaveBeenCalled();
  });
});

describe('aiCheckChapter — mapping, grounding, suppression', () => {
  it('maps a grounded conflict + missing finding to marks (real adapter runs)', async () => {
    completeJson.mockResolvedValueOnce({
      conflicts: [
        {
          quote: 'twenty-three members',
          entryId: 'sept',
          reason: 'The Sept has twenty-one members.',
          recorded: 'Members: Twenty-one, never more',
        },
      ],
      missing: [
        { quote: 'her grandmother\u2019s iron key', reason: 'Not in the wiki yet.' },
      ],
    });
    const res = await aiCheckChapter({ paragraphs });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    const byRule = res.data.marks.map((m) => m.ruleId).sort();
    expect(byRule).toEqual([AI_CONFLICT_RULE_ID, AI_MISSING_RULE_ID].sort());
    const conflict = res.data.marks.find((m) => m.ruleId === AI_CONFLICT_RULE_ID)!;
    expect(conflict.position.paragraphIndex).toBe(0);
    const missing = res.data.marks.find((m) => m.ruleId === AI_MISSING_RULE_ID)!;
    expect(missing.position.paragraphIndex).toBe(1);
  });

  it('DROPS a hallucinated quote (grounding guard) via the real adapter', async () => {
    completeJson.mockResolvedValueOnce({
      conflicts: [{ quote: 'a dragon named Fyre', entryId: 'sept', reason: 'invented' }],
      missing: [],
    });
    const res = await aiCheckChapter({ paragraphs });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.marks).toEqual([]);
  });

  it('suppresses a finding whose markKey is already resolved', async () => {
    const finding = {
      conflicts: [
        { quote: 'twenty-three members', entryId: 'sept', reason: 'x', recorded: 'y' },
      ],
      missing: [],
    };
    // First pass: learn the markKey the adapter assigns to this finding.
    completeJson.mockResolvedValueOnce(finding);
    const first = await aiCheckChapter({ paragraphs });
    if (!first.ok) throw new Error('expected ok');
    expect(first.data.marks).toHaveLength(1);
    const resolvedKey = first.data.marks[0]!.markKey;

    // Second pass, same finding, but now that key is in resolvedMarkKeys => dropped.
    completeJson.mockResolvedValueOnce(finding);
    const second = await aiCheckChapter({
      paragraphs,
      resolvedMarkKeys: [resolvedKey],
    });
    if (!second.ok) throw new Error('expected ok');
    expect(second.data.marks).toEqual([]);
  });

  it("uses the model's echoed paragraph number to anchor an identical substring", async () => {
    const dup = ['the key turned twice', 'she found the key again'];
    // "the key" is in BOTH paragraphs; the model says it meant P1.
    completeJson.mockResolvedValueOnce({
      conflicts: [],
      missing: [{ quote: 'the key', reason: 'x', paragraph: 1 }],
    });
    const res = await aiCheckChapter({ paragraphs: dup });
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.marks).toHaveLength(1);
    expect(res.data.marks[0]!.position.paragraphIndex).toBe(1);
  });
});

describe('aiCheckChapter — failure handling', () => {
  it('returns a typed error (never throws) when the gateway fails', async () => {
    completeJson.mockRejectedValueOnce(new Error('gateway 500'));
    const res = await aiCheckChapter({ paragraphs });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected failure');
    expect(res.error).toBe('gateway 500');
  });
});
