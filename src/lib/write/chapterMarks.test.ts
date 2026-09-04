import { describe, expect, it } from 'vitest';

import { hashValue } from '@/lib/check/hash';
import type { ChapterCheckCacheRow, WikiSnapshot } from '@/lib/domain/types';
import { paragraphsToDoc } from './adapters';
import { loadChapterMarks, type ChapterMarksReader } from './chapterMarks';

// The whole point of the reader port: no Postgres, no gateway, no network.
const EMPTY_WIKI: WikiSnapshot = {
  entries: [],
  byId: {},
  overrides: {},
  categories: [],
};

const CH1 = paragraphsToDoc(['The chair had four legs.']);
const CH2 = paragraphsToDoc(['Nothing to see here.']);

/** An AI mark, as a cache row stores it (AI-only — never the merged set). */
function aiConflict(markKey: string) {
  return {
    markKey,
    kind: 'conflict',
    ruleId: 'ai.conflict',
    quote: 'four legs',
    rail: 'contradicts the gazetteer',
    noteText: 'The gazetteer records five.',
    actions: [],
    position: { paragraph: 0, start: 0, end: 9 },
  };
}

function cacheRow(over: Partial<ChapterCheckCacheRow> = {}): ChapterCheckCacheRow {
  return {
    chapterId: 'ch1',
    bodyHash: hashValue(CH1),
    wikiHash: hashValue(EMPTY_WIKI),
    marks: [aiConflict('ai-1')],
    checkedAt: 0,
    ...over,
  };
}

function reader(over: Partial<ChapterMarksReader> = {}): ChapterMarksReader {
  return {
    wikiSnapshot: async () => EMPTY_WIKI,
    resolvedMarkKeys: async () => [],
    bookChapters: async () => [
      { id: 'ch1', number: 1, body: CH1 },
      { id: 'ch2', number: 2, body: CH2 },
    ],
    phraseChapterCounts: async () => new Map(),
    checkCache: async () => null,
    aiEnabled: () => true,
    ...over,
  };
}

const OPEN_CH1 = { universeId: 'u', bookId: 'b', chapterNumber: 1, body: CH1 };

describe('the freshness gate', () => {
  it('rehydrates cached AI marks when body and wiki both still hash the same', async () => {
    const marks = await loadChapterMarks(OPEN_CH1, reader({ checkCache: async () => cacheRow() }));
    expect(marks.aiMarks.map((m) => m.markKey)).toEqual(['ai-1']);
  });

  it('drops them when the body has changed since the check', async () => {
    const marks = await loadChapterMarks(
      OPEN_CH1,
      reader({ checkCache: async () => cacheRow({ bodyHash: 'stale' }) }),
    );
    expect(marks.aiMarks).toEqual([]);
  });

  it('drops them when the WIKI has changed since the check', async () => {
    // The second half of the gate. Dropping this term is invisible in a body-only
    // test: the AI grounds on the snapshot, so a wiki edit invalidates the row.
    const marks = await loadChapterMarks(
      OPEN_CH1,
      reader({ checkCache: async () => cacheRow({ wikiHash: 'stale' }) }),
    );
    expect(marks.aiMarks).toEqual([]);
  });

  it('ignores a fresh row entirely when the gateway is not configured', async () => {
    const marks = await loadChapterMarks(
      OPEN_CH1,
      reader({ aiEnabled: () => false, checkCache: async () => cacheRow() }),
    );
    expect(marks.aiMarks).toEqual([]);
  });

  it('reads no cache rows at all when AI is off', async () => {
    let reads = 0;
    await loadChapterMarks(
      OPEN_CH1,
      reader({
        aiEnabled: () => false,
        checkCache: async () => {
          reads += 1;
          return null;
        },
      }),
    );
    expect(reads).toBe(0);
  });
});

describe('the left-index dots', () => {
  it('forces the OPEN chapter to null so its dot is never redundant', async () => {
    const marks = await loadChapterMarks(
      OPEN_CH1,
      reader({ checkCache: async () => cacheRow() }),
    );
    expect(marks.severityByNumber.get(1)).toBeNull();
  });

  it('gives a sibling chapter the severity of its own resolved marks', async () => {
    // ch2's cache is fresh for ch2's OWN body, so its dot reflects the AI conflict
    // the rail would show on open — the disagreement this module exists to prevent.
    const marks = await loadChapterMarks(
      OPEN_CH1,
      reader({
        checkCache: async (id) =>
          id === 'ch2'
            ? cacheRow({ chapterId: 'ch2', bodyHash: hashValue(CH2) })
            : null,
      }),
    );
    expect(marks.severityByNumber.get(2)).toBe('red');
  });

  it('leaves a clean sibling with no dot', async () => {
    const marks = await loadChapterMarks(OPEN_CH1, reader());
    expect(marks.severityByNumber.get(2)).toBeNull();
  });
});

describe('the resolution the client re-runs against', () => {
  it('hands back the snapshot as the engine projection, not the DB shape', async () => {
    const marks = await loadChapterMarks(OPEN_CH1, reader());
    expect(marks.wiki).toEqual({ entries: [] });
  });

  it('loads the snapshot at the scope it was asked for', async () => {
    const seen: string[] = [];
    await loadChapterMarks(
      { universeId: 'u9', bookId: 'b9', chapterNumber: 1, body: CH1 },
      reader({
        wikiSnapshot: async (universeId, bookId) => {
          seen.push(`${universeId}/${bookId}`);
          return EMPTY_WIKI;
        },
      }),
    );
    expect(seen).toEqual(['u9/b9']);
  });
});
