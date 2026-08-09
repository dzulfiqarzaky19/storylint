import { test, expect } from "@playwright/test";
import { databaseUrl, withDb } from "./_helpers/db";

// -----------------------------------------------------------------------------
// SCOPED CROSS-CHAPTER COUNTS (integration, DB read-back — no browser).
//
// getPhraseChapterCounts(phrases[]) was scoped from "return the whole book-wide
// index" to "return counts ONLY for the phrases the caller asks about" (WHERE
// phrase = ANY($1)), so the write page stops serializing the entire index to the
// client every load. The CORRECTNESS CONTRACT is that scoping the WHERE must
// NOT shrink the recurrence count: COUNT(DISTINCT chapter_number) is still
// evaluated over ALL of a phrase's rows. A phrase in ch3 + ch7 must still report
// 2 even when the lookup is issued in a ch3 context — because importanceOf ranks
// an unrecorded mark 'high' at chapterCount >= 2 (rank, never gate). If scoping
// accidentally counted only the queried chapter, cross-chapter ranking would
// silently collapse to 1 everywhere.
//
// This calls the REAL shipped src/lib/db/queries getPhraseChapterCounts in Node
// (framework-free pool, reads DATABASE_URL) — no copy, no browser.
//
// Isolation: two SCRATCH chapters (9003, 9007, outside the seeded 1..7 range)
// stand in for "chapter 3" and "chapter 7" so seeded phrase_mentions are never
// touched. Cleanup is a surgical DELETE of just those two chapters in afterAll,
// never a reseed/truncate.
// -----------------------------------------------------------------------------

const CH_A = 9003; // stands in for "chapter 3" (the querying context)
const CH_B = 9007; // stands in for "chapter 7" (the other chapter)
const RECURRING = "her mother's brass ring"; // present in BOTH scratch chapters
const LOCAL_ONLY = "the tallow rule"; // present in CH_A only

let getPhraseChapterCounts: (
  phrases: readonly string[],
) => Promise<Map<string, number>>;

async function seedMention(phrase: string, chapter: number): Promise<void> {
  await withDb((client) =>
    client.query(
      `INSERT INTO phrase_mentions (phrase, chapter_number, count)
         VALUES ($1, $2, 1)
       ON CONFLICT (phrase, chapter_number) DO NOTHING`,
      [phrase, chapter],
    ),
  );
}

async function clearScratch(): Promise<void> {
  await withDb((client) =>
    client.query(`DELETE FROM phrase_mentions WHERE chapter_number = ANY($1)`, [
      [CH_A, CH_B],
    ]),
  );
}

test.beforeAll(async () => {
  process.env.DATABASE_URL ??= databaseUrl();
  ({ getPhraseChapterCounts } = await import("../../src/lib/db/queries"));
  await clearScratch();
  // RECURRING appears in both scratch chapters; LOCAL_ONLY in just one.
  await seedMention(RECURRING, CH_A);
  await seedMention(RECURRING, CH_B);
  await seedMention(LOCAL_ONLY, CH_A);
});

test.afterAll(clearScratch);

test("scoped counts: a phrase in two chapters returns 2 (book-wide DISTINCT survives scoping)", async () => {
  // Query from the "chapter 3" (CH_A) context, asking only about that chapter's
  // phrases. The recurring phrase must STILL report 2 — the DISTINCT-chapter
  // aggregate spans the whole book, not just the queried set.
  const counts = await getPhraseChapterCounts([RECURRING, LOCAL_ONLY]);

  expect(counts.get(RECURRING)).toBe(2); // ch3 + ch7 -> 2 (the crux)
  expect(counts.get(LOCAL_ONLY)).toBe(1); // in no other chapter -> 1 (negative)
});

test("scoped counts: only the asked-for phrases come back (the scoping itself)", async () => {
  // Ask about ONLY the local phrase. The recurring phrase's rows exist in the
  // table but must NOT appear, because WHERE phrase = ANY($1) excludes it.
  const counts = await getPhraseChapterCounts([LOCAL_ONLY]);

  expect(counts.get(LOCAL_ONLY)).toBe(1);
  expect(counts.has(RECURRING)).toBe(false); // scoped out, even though it exists
  expect(counts.size).toBe(1);
});

test("scoped counts: an empty phrase list returns an empty map (no full-table scan)", async () => {
  const counts = await getPhraseChapterCounts([]);
  expect(counts.size).toBe(0);
});
