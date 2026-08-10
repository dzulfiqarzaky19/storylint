import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { getChapter, getAppearancesForEntry, loadWikiSnapshot } from "@/lib/db/queries";
import { getNextChapterNumber, insertChapter } from "@/lib/db/mutations";
import { DEFAULT_UNIVERSE_ID, DEFAULT_SERIES_ID, DEFAULT_BOOK_ID } from "@/lib/db/scope";

// -----------------------------------------------------------------------------
// F7-S2 — book-scoped reads, CROSS-BOOK LEAK LOCK (INTEGRATION, real Postgres).
//
// After S1a/S1b every chapter/appearance carries a book_id and chapter `number`
// is unique only WITHIN a book (UNIQUE(book_id, number)). This test stands up a
// SECOND book B2 under the same series, gives it its own Chapter 1 and an
// appearance on an entry, and proves the scoped reads never leak across books:
//
//  - getChapter(1, B2) returns B2's Ch.1, NOT B1's Ch.1.
//  - getAppearancesForEntry(entry, B2) surfaces only B2's appearance, never the
//    same entry's B1 Chapter-1 appearance.
//  - getNextChapterNumber(B2) = 2 (B2 has one chapter), NOT B1's global max+1.
//  - loadWikiSnapshot(U1, B2) scopes appearances to B2.
//
// MUTATION: drop `AND book_id = $n` from getChapter / getAppearancesForEntry, or
// the `WHERE book_id` from getNextChapterNumber / loadWikiSnapshot's appearance
// read -> the matching assertion goes RED.
//
// SHARED-DB HYGIENE: all ids are `test-f7s2-<uuid>`; the whole fixture (book B2,
// its chapter, the entry, its appearances) is hard-deleted in afterEach in FK
// order. book-1 / universe-1 / series-1 are never touched.
// -----------------------------------------------------------------------------

loadEnv();

const B2 = `test-f7s2-book-${randomUUID()}`;
let entryId = "";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  // Second book under the SAME default series/universe as book-1.
  await query(`INSERT INTO books (id, series_id, name, sort_order) VALUES ($1, $2, 'F7S2 Book', 99)`, [
    B2,
    DEFAULT_SERIES_ID,
  ]);

  // An entry in the default universe that appears in BOTH books' Chapter 1.
  entryId = `test-f7s2-e-${randomUUID()}`;
  await query(
    `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order, universe_id)
     VALUES ($1, 'world', 'F7S2 Spire', 'F7S2', '', '', 'places', 999, $2)`,
    [entryId, DEFAULT_UNIVERSE_ID],
  );

  // B1 (default book) Chapter 1 already exists in seed at number 1. Give the
  // entry a B1 Chapter-1 appearance (the row that must NOT leak into B2 reads).
  await query(
    `INSERT INTO chapter_appearances (id, entry_id, chapter, text, sort_order, book_id)
     VALUES ($1, $2, 1, 'appears in B1 ch1', 0, $3)`,
    [`test-f7s2-a-b1-${randomUUID()}`, entryId, DEFAULT_BOOK_ID],
  );

  // B2 Chapter 1 (its own row, same number 1, different book) + the entry's B2
  // Chapter-1 appearance.
  const b2ChId = `test-f7s2-ch-${randomUUID()}`;
  await insertChapter({ id: b2ChId, number: 1, title: "B2 One", body: {}, bookId: B2 });
  await query(
    `INSERT INTO chapter_appearances (id, entry_id, chapter, text, sort_order, book_id)
     VALUES ($1, $2, 1, 'appears in B2 ch1', 0, $3)`,
    [`test-f7s2-a-b2-${randomUUID()}`, entryId, B2],
  );
});

afterAll(async () => {
  await query(`DELETE FROM chapter_appearances WHERE entry_id = $1`, [entryId]);
  await query(`DELETE FROM chapters WHERE book_id = $1`, [B2]);
  await query(`DELETE FROM entries WHERE id = $1`, [entryId]);
  await query(`DELETE FROM books WHERE id = $1`, [B2]);
  await closePool();
});

describe("F7-S2 cross-book leak lock (real Postgres)", () => {
  it("getChapter(1, B2) returns B2's Chapter 1, not B1's", async () => {
    const b2 = await getChapter(1, B2);
    const b1 = await getChapter(1, DEFAULT_BOOK_ID);
    expect(b2?.title).toBe("B2 One"); // lock: the B2 row, not whatever B1 ch1 is
    expect(b1?.title).not.toBe("B2 One"); // B1 ch1 is the seeded chapter
    expect(b2?.id).not.toBe(b1?.id); // two distinct chapters
  });

  it("getAppearancesForEntry(entry, B2) does NOT surface the B1 Chapter-1 appearance", async () => {
    const b2 = await getAppearancesForEntry(entryId, B2);
    const b1 = await getAppearancesForEntry(entryId, DEFAULT_BOOK_ID);
    expect(b2.map((a) => a.text)).toEqual(["appears in B2 ch1"]); // ONLY B2's
    expect(b2.some((a) => a.text === "appears in B1 ch1")).toBe(false); // no leak
    expect(b1.some((a) => a.text === "appears in B1 ch1")).toBe(true); // B1 still sees its own
  });

  it("getNextChapterNumber(B2) = 2 (per-book), not B1's global max+1", async () => {
    const nextB2 = await getNextChapterNumber(B2);
    const nextB1 = await getNextChapterNumber(DEFAULT_BOOK_ID);
    expect(nextB2).toBe(2); // B2 has exactly one chapter (number 1)
    expect(nextB1).toBeGreaterThan(2); // B1 (seeded) has many chapters
  });

  it("loadWikiSnapshot(U1, B2) scopes the entry's appearances to B2", async () => {
    const snap = await loadWikiSnapshot(DEFAULT_UNIVERSE_ID, B2);
    const e = snap.byId[entryId];
    expect(e).toBeDefined();
    expect(e!.appearances.map((a) => a.text)).toEqual(["appears in B2 ch1"]); // no B1 leak
  });
});
