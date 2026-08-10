import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import {
  getWorldTree,
  previewUniverseCascade,
  previewSeriesCascade,
  previewBookCascade,
} from "@/lib/db/queries";
import {
  insertEntry,
  insertFact,
  insertChapter,
  insertUniverse,
  insertSeries,
  insertBook,
  deleteUniverseCascade,
  deleteSeriesCascade,
  deleteBookCascade,
} from "@/lib/db/mutations";
import { confirmWikiWrite } from "@/lib/actions/confirmation";
import { DEFAULT_UNIVERSE_ID } from "@/lib/db/scope";

// -----------------------------------------------------------------------------
// F7-S5 — SWITCHER READ + DELETE PREVIEW (INTEGRATION, real Postgres).
//
// getWorldTree() feeds the top-bar picker: universes -> series -> books, NESTED.
// The nesting is the load-bearing invariant (a book must appear under its OWN
// series under its OWN universe); a dropped parent predicate flattens/mis-nests
// the picker. previewXCascade() is the danger-modal's advisory row count; it MUST
// equal what deleteXCascade actually removes (advisory === authoritative).
//
// FIXTURE: a throwaway universe with TWO series, each with TWO books, so a
// mis-nesting mutation (book under the wrong series, series under the wrong
// universe) is observable. Plus content on one book to give the preview non-zero
// numbers to match against the real delete.
//
// SHARED-DB HYGIENE: ids `test-f7s5sw-*`; afterAll hard-deletes residue in FK
// order (delete tests already remove their own subtree; afterAll covers failures).
// The DEFAULT universe (universe-1) is never structurally deleted.
// -----------------------------------------------------------------------------

loadEnv();

const confirm = confirmWikiWrite({ confirmed: true });

const uId = `test-f7s5sw-uni-${randomUUID()}`;
const seAId = `test-f7s5sw-ser-${randomUUID()}`;
const seBId = `test-f7s5sw-ser-${randomUUID()}`;
const bA1Id = `test-f7s5sw-bk-${randomUUID()}`;
const bA2Id = `test-f7s5sw-bk-${randomUUID()}`;
const bB1Id = `test-f7s5sw-bk-${randomUUID()}`;
const bB2Id = `test-f7s5sw-bk-${randomUUID()}`;
const entId = `test-f7s5sw-ent-${randomUUID()}`;
const canonFactId = `test-f7s5sw-fact-${randomUUID()}`;
const bookFactId = `test-f7s5sw-fact-${randomUUID()}`;
const chapId = `test-f7s5sw-chap-${randomUUID()}`;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterAll(async () => {
  await query(`DELETE FROM facts WHERE id = ANY($1)`, [[canonFactId, bookFactId]]);
  await query(`DELETE FROM chapters WHERE id = ANY($1)`, [[chapId]]);
  await query(`DELETE FROM entries WHERE id = ANY($1)`, [[entId]]);
  await query(`DELETE FROM books WHERE id = ANY($1)`, [[bA1Id, bA2Id, bB1Id, bB2Id]]);
  await query(`DELETE FROM series WHERE id = ANY($1)`, [[seAId, seBId]]);
  await query(`DELETE FROM universes WHERE id = ANY($1)`, [[uId]]);
  await closePool();
});

describe("F7-S5 switcher read + delete preview (real Postgres)", () => {
  it("getWorldTree nests each series under its universe and each book under its series", async () => {
    await insertUniverse({ id: uId, name: "Switcher World" });
    await insertSeries({ id: seAId, name: "Series A", universeId: uId, sortOrder: 0 });
    await insertSeries({ id: seBId, name: "Series B", universeId: uId, sortOrder: 1 });
    await insertBook({ id: bA1Id, name: "A-1", seriesId: seAId, sortOrder: 0 });
    await insertBook({ id: bA2Id, name: "A-2", seriesId: seAId, sortOrder: 1 });
    await insertBook({ id: bB1Id, name: "B-1", seriesId: seBId, sortOrder: 0 });
    await insertBook({ id: bB2Id, name: "B-2", seriesId: seBId, sortOrder: 1 });

    const tree = await getWorldTree();
    const u = tree.find((x) => x.id === uId);
    expect(u).toBeDefined();

    // Universe -> series nesting: exactly Series A and B, under THIS universe.
    const seriesIds = u!.series.map((s) => s.id).sort();
    expect(seriesIds).toEqual([seAId, seBId].sort());

    // Series -> book nesting: A's books are ONLY A-1/A-2; B's are ONLY B-1/B-2.
    const seA = u!.series.find((s) => s.id === seAId)!;
    const seB = u!.series.find((s) => s.id === seBId)!;
    expect(seA.books.map((b) => b.id).sort()).toEqual([bA1Id, bA2Id].sort());
    expect(seB.books.map((b) => b.id).sort()).toEqual([bB1Id, bB2Id].sort());
    // Cross-check: a B book NEVER surfaces under series A (the mis-nest mutation).
    expect(seA.books.some((b) => b.id === bB1Id || b.id === bB2Id)).toBe(false);
    expect(seB.books.some((b) => b.id === bA1Id || b.id === bA2Id)).toBe(false);

    // The DEFAULT universe still appears (getWorldTree lists all universes).
    expect(tree.some((x) => x.id === DEFAULT_UNIVERSE_ID)).toBe(true);
  });

  it("previewUniverseCascade total === deleteUniverseCascade total (advisory === authoritative === removed)", async () => {
    // Give book B-1 some content so the preview has non-zero, matchable numbers.
    await insertEntry(
      { id: entId, kind: "character", name: "Prev", catalogueNo: "SW", note: "", summary: "", shelf: "characters", sortOrder: 0, universeId: uId },
      confirm,
    );
    await insertFact({ id: canonFactId, entryId: entId, key: "k", value: "canon", fresh: false, sortOrder: 0 }, confirm);
    await insertFact({ id: bookFactId, entryId: entId, key: "k", value: "book-only", fresh: false, sortOrder: 1, bookId: bB1Id }, confirm);
    await insertChapter({ id: chapId, number: 1, title: "SW Ch1", body: { type: "doc" }, bookId: bB1Id });

    // Advisory FIRST (read-only), then the authoritative delete, then compare.
    const preview = await previewUniverseCascade(uId);
    expect(preview.total).toBeGreaterThan(0);

    const count = await deleteUniverseCascade(uId);
    // The advisory count must equal exactly what the transaction removed.
    expect(count.total).toBe(preview.total);
    // Spot-check the breakdown lines the preview mirrors.
    expect(preview.entries).toBe(count.entries);
    expect(preview.facts).toBe(count.facts);
    expect(preview.books).toBe(count.books);
    expect(preview.series).toBe(count.series);
    expect(preview.universes).toBe(count.universes);
  });

  it("previewSeriesCascade / previewBookCascade match their deletes", async () => {
    // Fresh throwaway universe with one series + one book + book content.
    const u2 = `test-f7s5sw-uni-${randomUUID()}`;
    const se2 = `test-f7s5sw-ser-${randomUUID()}`;
    const bk2 = `test-f7s5sw-bk-${randomUUID()}`;
    const bk3 = `test-f7s5sw-bk-${randomUUID()}`;
    const ent2 = `test-f7s5sw-ent-${randomUUID()}`;
    const f2 = `test-f7s5sw-fact-${randomUUID()}`;
    const ch2 = `test-f7s5sw-chap-${randomUUID()}`;
    try {
      await insertUniverse({ id: u2, name: "Prev2 World" });
      await insertSeries({ id: se2, name: "Prev2 Series", universeId: u2, sortOrder: 0 });
      await insertBook({ id: bk2, name: "Prev2 Book", seriesId: se2, sortOrder: 0 });
      await insertBook({ id: bk3, name: "Prev2 Book B", seriesId: se2, sortOrder: 1 });
      await insertEntry(
        { id: ent2, kind: "character", name: "P2", catalogueNo: "P2", note: "", summary: "", shelf: "characters", sortOrder: 0, universeId: u2 },
        confirm,
      );
      await insertFact({ id: f2, entryId: ent2, key: "k", value: "book", fresh: false, sortOrder: 0, bookId: bk2 }, confirm);
      await insertChapter({ id: ch2, number: 1, title: "P2 Ch1", body: { type: "doc" }, bookId: bk2 });

      // BOOK preview vs delete (bk2 only; bk3 + entry must survive).
      const bookPreview = await previewBookCascade(bk2);
      const bookCount = await deleteBookCascade(bk2);
      expect(bookCount.total).toBe(bookPreview.total);
      expect(bookCount.books).toBe(1);

      // SERIES preview vs delete (removes se2 + its remaining book bk3).
      const seriesPreview = await previewSeriesCascade(se2);
      const seriesCount = await deleteSeriesCascade(se2);
      expect(seriesCount.total).toBe(seriesPreview.total);
      expect(seriesCount.books).toBe(1); // bk3 (bk2 already gone)
      expect(seriesCount.series).toBe(1);
    } finally {
      await query(`DELETE FROM facts WHERE id = ANY($1)`, [[f2]]);
      await query(`DELETE FROM chapters WHERE id = ANY($1)`, [[ch2]]);
      await query(`DELETE FROM entries WHERE id = ANY($1)`, [[ent2]]);
      await query(`DELETE FROM books WHERE id = ANY($1)`, [[bk2, bk3]]);
      await query(`DELETE FROM series WHERE id = ANY($1)`, [[se2]]);
      await query(`DELETE FROM universes WHERE id = ANY($1)`, [[u2]]);
    }
  });
});
