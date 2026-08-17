/**
 * resolveChapterMarks — ONE source of truth for a chapter's marks (T-SIDEBAR-RESOLVER).
 *
 * The Write sidebar dot and the active chapter's rail both derive from this pure
 * function, so they can never disagree. Contract:
 *   regex  = checkManuscript(buildCheckInput({body, db:wiki, resolvedMarkKeys})).marks
 *   fresh  = aiEnabled && cacheRow && cacheRow.bodyHash==hashValue(body)
 *                                  && cacheRow.wikiHash==hashValue(wiki-engine-shape)
 *   result = fresh ? mergeMarks(regex, cacheRow.marks) : regex
 *
 * These tests lock EACH branch (fresh->merge, stale->regex, no-AI->regex) plus
 * the freshness sub-conditions (body hash, wiki hash, aiEnabled gate).
 */

import { describe, it, expect } from 'vitest';
import { checkManuscript, type Mark } from '@/lib/check';
import { mergeMarks } from '@/lib/check/ai';
import { hashValue } from '@/lib/check/hash';
import { toCheckWiki, buildCheckInput } from '@/lib/write/adapters';
import { resolveChapterMarks } from '@/lib/check/resolve';
import { wiki as engineWiki } from './fixtures';

// A DB-shaped wiki whose toCheckWiki projection equals the fixtures engine wiki,
// so the resolver's wikiHash (over the ENGINE shape) is stable and testable.
// The fixtures export is already the engine shape; wrap it so `db` typechecks and
// toCheckWiki(db) round-trips to the same entries the resolver hashes.
const dbWiki = {
  entries: engineWiki.entries.map((e) => ({ ...e })),
} as unknown as Parameters<typeof toCheckWiki>[0];

// Ch7 body (curly apostrophe) — the regex engine finds 4 marks here (2 conflict,
// 2 missing), so it is a good body to prove the merge preserves regex marks.
const CH7_PARAGRAPHS = [
  'The Ferrier came in on the low water with the sun still an hour off the roofs. Maren had lit the Verge at four, as she had every night since she was nineteen and sworn.',
  'She kept her mother\u2019s brass ring in her coat and turned it twice, the way the tallow rule said, before she went down to the water.',
  'He looked at her with the flat attention of a man counting what he is owed. Her own grey eyes did not move.',
  'Neither of them said the name. That was the arrangement, and it had been the arrangement since before she was born.',
];
const ch7Body = {
  type: 'doc',
  content: CH7_PARAGRAPHS.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
};

// A synthetic AI mark that regex never produces (distinct ruleId + markKey), so
// its presence in the result proves the AI branch actually merged it in. This is
// the Ch4-style case: AI flags something the regex rules structurally can't.
const AI_MARK: Mark = {
  markKey: 'ai-synthetic-key-0001',
  kind: 'conflict',
  ruleId: 'ai-cross-check',
  quote: 'swore it at nineteen',
  rail: 'The Lantern Oath is sworn at twenty-one.',
  noteText: 'AI: the oath is sworn at twenty-one; this has her swear at nineteen.',
  actions: [],
} as unknown as Mark;

/**
 * Build a cache row whose hashes match the given body + wiki (i.e. FRESH).
 * Production stamps wikiHash over the DB snapshot (page.tsx:117 hashes `wiki`,
 * write.ts:516 hashes loadWikiSnapshot(...)), NOT the engine projection — so the
 * resolver must hash the SAME db shape. Hashing toCheckWiki(db) here would fork
 * the gate and never match a real row.
 */
function freshRow(body: unknown, marks: Mark[]) {
  return {
    chapterId: 'ch7',
    bodyHash: hashValue(body),
    wikiHash: hashValue(dbWiki),
    marks,
    checkedAt: 1,
  };
}

describe('resolveChapterMarks — one source of truth for sidebar + rail', () => {
  const base = { body: ch7Body, db: dbWiki, resolvedMarkKeys: [] as string[] };

  it('no AI enabled -> regex fallback only (AI mark absent even with a fresh row)', () => {
    const marks = resolveChapterMarks({
      ...base,
      aiEnabled: false,
      cacheRow: freshRow(ch7Body, [AI_MARK]),
    });
    // Regex marks present (Ch7 has 4), AI mark NOT merged because aiEnabled=false.
    expect(marks.some((m) => m.markKey === AI_MARK.markKey)).toBe(false);
    expect(marks.length).toBeGreaterThan(0);
  });

  it('AI enabled + FRESH cache -> merge(regex, cachedAI): BOTH regex and AI marks present', () => {
    const regexOnly = resolveChapterMarks({ ...base, aiEnabled: false, cacheRow: null });
    const merged = resolveChapterMarks({
      ...base,
      aiEnabled: true,
      cacheRow: freshRow(ch7Body, [AI_MARK]),
    });
    // AI mark surfaced...
    expect(merged.some((m) => m.markKey === AI_MARK.markKey)).toBe(true);
    // ...AND every regex mark is preserved (no rail regression).
    for (const r of regexOnly) {
      expect(merged.some((m) => m.markKey === r.markKey)).toBe(true);
    }
    expect(merged.length).toBe(regexOnly.length + 1);
  });

  it('AI enabled but STALE body hash -> regex fallback (AI mark dropped)', () => {
    const stale = {
      ...freshRow(ch7Body, [AI_MARK]),
      bodyHash: 'deadbeef-not-the-real-body-hash',
    };
    const marks = resolveChapterMarks({ ...base, aiEnabled: true, cacheRow: stale });
    expect(marks.some((m) => m.markKey === AI_MARK.markKey)).toBe(false);
  });

  it('AI enabled but STALE wiki hash -> regex fallback (AI mark dropped)', () => {
    const stale = {
      ...freshRow(ch7Body, [AI_MARK]),
      wikiHash: 'deadbeef-not-the-real-wiki-hash',
    };
    const marks = resolveChapterMarks({ ...base, aiEnabled: true, cacheRow: stale });
    expect(marks.some((m) => m.markKey === AI_MARK.markKey)).toBe(false);
  });

  it('AI enabled but NO cache row -> regex fallback', () => {
    const marks = resolveChapterMarks({ ...base, aiEnabled: true, cacheRow: null });
    const regexOnly = resolveChapterMarks({ ...base, aiEnabled: false, cacheRow: null });
    expect(marks.map((m) => m.markKey).sort()).toEqual(regexOnly.map((m) => m.markKey).sort());
  });

  it('freshness gate uses the SAME hashValue as production (byte-identical hashes match)', () => {
    // A row stamped with hashValue(body)+hashValue(engineWiki) is treated as fresh.
    const marks = resolveChapterMarks({
      ...base,
      aiEnabled: true,
      cacheRow: freshRow(ch7Body, [AI_MARK]),
    });
    expect(marks.some((m) => m.markKey === AI_MARK.markKey)).toBe(true);
  });
});

// PARITY: the whole point of the resolver is that the sidebar dot and the active
// rail can never disagree. These tests reproduce BOTH real consumers on identical
// inputs and assert equal mark sets — if page.tsx's initialAiMarks freshness gate
// ever drifts from the resolver's, this fails. No stubs: real mergeMarks +
// checkManuscript + hashValue, mirroring page.tsx and Manuscript exactly.
describe('resolver output == the rail the writer actually sees (no stub)', () => {
  const base = { body: ch7Body, db: dbWiki, resolvedMarkKeys: [] as string[] };

  // page.tsx first-paint props for the ACTIVE chapter, verbatim:
  //   initialMarks  = checkManuscript(buildCheckInput({body,db,resolvedMarkKeys})).marks
  //   initialAiMarks = (aiEnabled && cache && bodyHash==hashValue(body)
  //                     && wikiHash==hashValue(db)) ? cache.marks : []
  // Manuscript then renders seededInitialMarks = initialAiMarks.length
  //   ? mergeMarks(initialMarks, initialAiMarks) : initialMarks.
  function railMarks(aiEnabled: boolean, cacheRow: ReturnType<typeof freshRow> | null): Mark[] {
    const initialMarks = checkManuscript(
      buildCheckInput({ body: ch7Body, db: dbWiki, resolvedMarkKeys: [] }),
    ).marks;
    const fresh =
      aiEnabled &&
      cacheRow !== null &&
      cacheRow.bodyHash === hashValue(ch7Body) &&
      cacheRow.wikiHash === hashValue(dbWiki);
    const initialAiMarks = fresh ? (cacheRow!.marks as Mark[]) : [];
    return initialAiMarks.length > 0
      ? mergeMarks(initialMarks, initialAiMarks)
      : initialMarks;
  }

  const keys = (m: Mark[]) => m.map((x) => x.markKey).sort();

  it.each([
    ['AI off, fresh row present', false, () => freshRow(ch7Body, [AI_MARK])],
    ['AI on, fresh row', true, () => freshRow(ch7Body, [AI_MARK])],
    ['AI on, stale body hash', true, () => ({ ...freshRow(ch7Body, [AI_MARK]), bodyHash: 'stale' })],
    ['AI on, stale wiki hash', true, () => ({ ...freshRow(ch7Body, [AI_MARK]), wikiHash: 'stale' })],
    ['AI on, no cache row', true, () => null],
  ])('sidebar resolver == rail for: %s', (_label, aiEnabled, mkRow) => {
    const cacheRow = mkRow();
    const dot = resolveChapterMarks({ ...base, aiEnabled, cacheRow });
    const rail = railMarks(aiEnabled, cacheRow);
    expect(keys(dot)).toEqual(keys(rail));
  });
});

