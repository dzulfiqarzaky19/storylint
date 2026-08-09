/**
 * resolveMark server action (HANDOFF section 8).
 *
 * resolveMark handles the three note actions under a flagged run. These unit
 * tests lock the branch behavior WITHOUT a database: the only DB write is the
 * 'leave' path (upsertResolvedMark), which we mock. The 'text' and 'wiki'
 * branches touch no persistence at all.
 *
 * The 'wiki' branch is where PRODUCT RULE 1 lives: "nothing enters the wiki
 * without an explicit confirmation." resolveMark must NEVER write the wiki
 * itself; it only returns a needsConfirmation handoff. A regression here would
 * be a rule-1 violation, so it is asserted explicitly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB mutation layer so no real Postgres is touched. Only 'leave'
// should ever reach it.
const upsertResolvedMark = vi.fn(async (_arg: unknown) => {});
vi.mock('@/lib/db/mutations', () => ({
  upsertResolvedMark: (arg: unknown) => upsertResolvedMark(arg),
  // resolveMark imports these siblings from the same module; stub them so the
  // module loads. They must never be called by resolveMark.
  saveChapterBody: vi.fn(),
  replacePhraseMentions: vi.fn(),
  insertChapter: vi.fn(),
  getNextChapterNumber: vi.fn(),
}));

import { resolveMark } from '@/lib/actions/write';

beforeEach(() => {
  upsertResolvedMark.mockClear();
  upsertResolvedMark.mockResolvedValue(undefined);
});

describe('resolveMark', () => {
  it("'leave' suppresses the mark by key and is the ONLY DB write", async () => {
    const res = await resolveMark('mark-key-1', 'leave');
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data).toEqual({ kind: 'resolved', markKey: 'mark-key-1' });

    // Persisted exactly once, keyed by the stable markKey, with resolution 'leave'.
    expect(upsertResolvedMark).toHaveBeenCalledTimes(1);
    const arg = upsertResolvedMark.mock.calls[0]![0] as unknown as {
      markKey: string;
      resolution: string;
      resolvedAt: number;
    };
    expect(arg.markKey).toBe('mark-key-1');
    expect(arg.resolution).toBe('leave');
    expect(typeof arg.resolvedAt).toBe('number');
  });

  it("'text' selects the run for editing and writes NOTHING", async () => {
    const res = await resolveMark('mark-key-2', 'text', { quote: 'her ring' });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data).toEqual({ kind: 'selectForEdit', quote: 'her ring' });
    expect(upsertResolvedMark).not.toHaveBeenCalled();
  });

  it("'text' defaults quote to '' when context omits it", async () => {
    const res = await resolveMark('mark-key-3', 'text');
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data).toEqual({ kind: 'selectForEdit', quote: '' });
  });

  it("'wiki' hands off to confirmation and NEVER writes the wiki (rule 1)", async () => {
    const res = await resolveMark('mark-key-4', 'wiki', {
      entryId: 'entry-7',
      factKey: 'eye-color',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    // The outcome is a confirmation HANDOFF, not a write.
    expect(res.data).toEqual({
      kind: 'needsConfirmation',
      entryId: 'entry-7',
      factKey: 'eye-color',
    });
    // Rule 1: no persistence path is invoked from resolveMark for a wiki resolution.
    expect(upsertResolvedMark).not.toHaveBeenCalled();
  });

  it("'wiki' defaults entryId/factKey to '' when context omits them", async () => {
    const res = await resolveMark('mark-key-5', 'wiki');
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data).toEqual({
      kind: 'needsConfirmation',
      entryId: '',
      factKey: '',
    });
  });

  it('returns a typed error (never throws) when the DB write fails', async () => {
    upsertResolvedMark.mockRejectedValueOnce(new Error('db down'));
    const res = await resolveMark('mark-key-6', 'leave');
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected failure');
    expect(res.error).toBe('db down');
  });
});
