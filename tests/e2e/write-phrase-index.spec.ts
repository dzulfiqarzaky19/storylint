import { test, expect } from "@playwright/test";
import { databaseUrl, withDb } from "./_helpers/db";

// -----------------------------------------------------------------------------
// PHRASE INDEX BATCH WRITE (integration, DB read-back — no browser).
//
// replacePhraseMentions() refreshes ONE chapter's rows in the book-wide
// phrase_mentions index (Tier 2 cross-chapter recurrence ranking). It was
// rewritten from a per-phrase INSERT loop to a single set-based INSERT via
// `UNNEST($1::text[], $3::int[])` so an N-phrase chapter costs one round-trip
// instead of N. This spec locks the batch shape against three regressions:
//
//   1. A RECURRING phrase (extractCandidatePhrases yields count > 1 under one
//      key) writes exactly ONE row with the summed count — the classic UNNEST
//      hazard is an in-batch duplicate key ("ON CONFLICT ... cannot affect row
//      a second time"). The Map source guarantees unique keys, but this proves
//      the whole path stays green when a phrase repeats, count and all.
//   2. Re-saving the SAME chapter REPLACES its rows (DELETE + re-INSERT in one
//      transaction): a phrase dropped from the body disappears, a kept phrase's
//      count updates. The index always mirrors the current body.
//   3. An EMPTY map just CLEARS the chapter's rows (no INSERT, no error).
//
// It calls the REAL shipped mutation (src/lib/db/mutations.ts) directly in the
// Playwright Node context — pool.ts is framework-free and reads DATABASE_URL —
// so it guards production code, not a copy. No page/browser is used.
//
// Isolation: everything happens under a SCRATCH chapter number (SCRATCH_CH,
// far outside the seeded 1..7 range) so seeded phrase_mentions rows are never
// touched. Cleanup is a surgical single-chapter DELETE via withDb in afterAll,
// NOT a full reseed (a reseed would TRUNCATE the whole table and is a blunt
// instrument for one scratch chapter's rows).
// -----------------------------------------------------------------------------

// pool.ts reads process.env.DATABASE_URL when it first builds its Pool. Playwright
// does not load .env.local, so mirror the app's loader before importing the
// mutation (import() is deferred to beforeAll, after the env is set).
const SCRATCH_CH = 9001;

// Loaded lazily in beforeAll once DATABASE_URL is guaranteed to be set.
let replacePhraseMentions: (input: {
  chapterNumber: number;
  phrases: ReadonlyMap<string, number>;
}) => Promise<void>;

async function scratchRows(): Promise<Array<{ phrase: string; count: number }>> {
  return withDb(async (client) => {
    const res = await client.query(
      `SELECT phrase, count FROM phrase_mentions
        WHERE chapter_number = $1
        ORDER BY phrase`,
      [SCRATCH_CH],
    );
    return res.rows as Array<{ phrase: string; count: number }>;
  });
}

async function clearScratch(): Promise<void> {
  await withDb((client) =>
    client.query(`DELETE FROM phrase_mentions WHERE chapter_number = $1`, [
      SCRATCH_CH,
    ]),
  );
}

test.beforeAll(async () => {
  process.env.DATABASE_URL ??= databaseUrl();
  ({ replacePhraseMentions } = await import("../../src/lib/db/mutations"));
  await clearScratch(); // start from a clean scratch chapter
});

// Surgical cleanup: only this scratch chapter's rows, so seeded data (and any
// concurrent state a later-sorting spec relies on) is left exactly as found.
test.afterAll(clearScratch);

test("phrase index: a recurring phrase writes one row with the summed count", async () => {
  // extractCandidatePhrases would map a thrice-repeated phrase to one key -> 3.
  await replacePhraseMentions({
    chapterNumber: SCRATCH_CH,
    phrases: new Map([
      ["her mother's brass ring", 3],
      ["the tallow rule", 1],
    ]),
  });

  const rows = await scratchRows();
  expect(rows).toEqual([
    { phrase: "her mother's brass ring", count: 3 },
    { phrase: "the tallow rule", count: 1 },
  ]);
  // Exactly one row per phrase — no duplicate-key abort on the recurring phrase.
  expect(rows.length).toBe(2);
});

test("phrase index: re-saving the chapter replaces its rows (drop + update)", async () => {
  // Seed a first state.
  await replacePhraseMentions({
    chapterNumber: SCRATCH_CH,
    phrases: new Map([
      ["her mother's brass ring", 3],
      ["the tallow rule", 1],
    ]),
  });

  // Re-save: "the tallow rule" is gone from the body, the ring's count changed,
  // and a new phrase appears. The batch must DELETE the old set and INSERT the new.
  await replacePhraseMentions({
    chapterNumber: SCRATCH_CH,
    phrases: new Map([
      ["her mother's brass ring", 5], // count updated
      ["the salt-name debt", 2], // newly appeared
      // "the tallow rule" dropped
    ]),
  });

  const rows = await scratchRows();
  expect(rows).toEqual([
    { phrase: "her mother's brass ring", count: 5 },
    { phrase: "the salt-name debt", count: 2 },
  ]);
  // The dropped phrase is truly gone, not left stale.
  expect(rows.some((r) => r.phrase === "the tallow rule")).toBe(false);
});

test("phrase index: an empty map clears the chapter's rows", async () => {
  await replacePhraseMentions({
    chapterNumber: SCRATCH_CH,
    phrases: new Map([["her mother's brass ring", 1]]),
  });
  expect((await scratchRows()).length).toBe(1);

  // An empty body clears the chapter from the index (no INSERT, no error).
  await replacePhraseMentions({
    chapterNumber: SCRATCH_CH,
    phrases: new Map(),
  });
  expect(await scratchRows()).toEqual([]);
});
