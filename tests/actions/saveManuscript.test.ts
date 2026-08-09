/**
 * saveManuscript server action (HANDOFF section 8) — best-effort phrase index.
 *
 * saveManuscript does TWO things: (1) persist the chapter body — the sacred
 * write; a failure here MUST return ok:false so the writer never sees a green
 * ack over lost prose — and (2) refresh the book-wide phrase_mentions index so
 * cross-chapter recurrence RANKING stays current. The index is RANK data only
 * (importanceOf reads it to rank a mark high-vs-normal; it NEVER gates WHAT is
 * flagged), so its refresh is BEST-EFFORT: an index failure is caught, logged
 * loudly (naming the chapter), and swallowed. The body is already saved.
 *
 * These tests lock that contract WITHOUT a database by mocking the DB layer:
 *   - index refresh throws  -> ok:true, body still persisted, error logged w/ chapter #
 *   - BODY save throws       -> ok:false (the narrow catch must NOT swallow this)
 *   - happy path             -> ok:true, body saved, index refreshed, NO error log
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ONLY the DB mutation layer so no real Postgres is touched. The phrase
// extraction (extractCandidatePhrases / docToParagraphs) is pure and left REAL,
// so the test exercises the true save path, not a hollow stub of it.
const saveChapterBody = vi.fn(async (_arg: unknown) => {});
const replacePhraseMentions = vi.fn(async (_arg: unknown) => {});
vi.mock('@/lib/db/mutations', () => ({
  saveChapterBody: (arg: unknown) => saveChapterBody(arg),
  replacePhraseMentions: (arg: unknown) => replacePhraseMentions(arg),
  // Siblings imported by the same action module; stubbed so it loads. Unused here.
  upsertResolvedMark: vi.fn(),
  insertChapter: vi.fn(),
  getNextChapterNumber: vi.fn(),
}));

import { saveManuscript } from '@/lib/actions/write';

// A minimal ProseMirror doc with real prose so extractCandidatePhrases has input.
const BODY = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: "Maren turned her mother's brass ring twice." },
      ],
    },
  ],
} as const;

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  saveChapterBody.mockClear();
  saveChapterBody.mockResolvedValue(undefined);
  replacePhraseMentions.mockClear();
  replacePhraseMentions.mockResolvedValue(undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('saveManuscript best-effort phrase index', () => {
  it('index refresh failure still returns ok:true, body persisted, logged with chapter #', async () => {
    // The side-table refresh fails deterministically...
    replacePhraseMentions.mockRejectedValueOnce(new Error('pg down'));

    const res = await saveManuscript({ chapterNumber: 3, body: BODY });

    // ...but the writer's prose still saved, and the ack is GREEN (never DATA LOSS).
    expect(res.ok).toBe(true);
    expect(saveChapterBody).toHaveBeenCalledTimes(1);
    expect((saveChapterBody.mock.calls[0]![0] as { number: number }).number).toBe(3);
    // We did attempt the refresh (best-effort, not skipped).
    expect(replacePhraseMentions).toHaveBeenCalledTimes(1);

    // The failure screams in the log AND names the chapter, so a systematic
    // index failure is diagnosable in prod instead of hiding as silent staleness.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = String(errorSpy.mock.calls[0]![0]);
    expect(logged).toContain('phrase-index refresh failed');
    expect(logged).toContain('chapter 3'); // names the chapter (chick's gate note 2)
    expect(logged).toContain('pg down'); // carries the underlying cause
  });

  it('a BODY-save failure is NOT swallowed — returns ok:false (narrow catch boundary)', async () => {
    // The sacred write itself fails. This must reach the user, not a green ack.
    saveChapterBody.mockRejectedValueOnce(new Error('disk full'));

    const res = await saveManuscript({ chapterNumber: 3, body: BODY });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected failure');
    expect(res.error).toContain('disk full');
    // The index refresh must never run when the body did not save.
    expect(replacePhraseMentions).not.toHaveBeenCalled();
    // A body failure is not an index-log event.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('happy path: body saved, index refreshed, no error logged', async () => {
    const res = await saveManuscript({ chapterNumber: 3, body: BODY });

    expect(res.ok).toBe(true);
    expect(saveChapterBody).toHaveBeenCalledTimes(1);
    expect(replacePhraseMentions).toHaveBeenCalledTimes(1);
    // Real extraction ran: the chapter's phrase map reached the index write.
    const arg = replacePhraseMentions.mock.calls[0]![0] as {
      chapterNumber: number;
      phrases: ReadonlyMap<string, number>;
    };
    expect(arg.chapterNumber).toBe(3);
    expect(arg.phrases.get("her mother's brass ring")).toBe(1);
    // Nothing failed, so nothing was logged.
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
