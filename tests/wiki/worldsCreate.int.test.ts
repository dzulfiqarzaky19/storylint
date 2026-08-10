import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, one, closePool } from "@/lib/db/pool";
import { loadWikiSnapshot } from "@/lib/db/queries";
import {
  insertSeries,
  insertBook,
  createFreshUniverse,
  getNextChapterNumber,
} from "@/lib/db/mutations";
import { DEFAULT_UNIVERSE_ID, DEFAULT_SERIES_ID } from "@/lib/db/scope";

// -----------------------------------------------------------------------------
// F7-S3 — worlds-hierarchy CREATION FLOWS (INTEGRATION, real Postgres).
//
// Structural creation of Series/Book/Universe. Continuation-vs-fresh is pure
// ROUTING (ratified by chick, data-model gate): no canon row-copy.
//
//  - CONTINUATION: insertSeries(under U1) + insertBook(under that series) stamp
//    the routed universe_id/series_id (NOT a hardcoded default). A book created
//    under U1 reuses U1's canon by construction — loadWikiSnapshot(U1, newBook)
//    still sees the SEEDED U1 entries (canon is universe-level, canon facts/ties
//    carry book_id=NULL). getNextChapterNumber(newBook)=1 (empty book).
//
//  - FRESH: createFreshUniverse mints a NEW universe + first series + first book
//    in one txn. Its wiki is EMPTY by construction — loadWikiSnapshot(newUni,
//    newBook) returns ZERO entries — because no entries carry the new universe_id.
//    The new book's getNextChapterNumber=1.
//
// MUTATIONS this locks:
//  M-series-route: insertSeries stamps DEFAULT_UNIVERSE_ID instead of the passed
//    universeId -> the "series carries the routed universe" assertion RED.
//  M-book-route: insertBook stamps DEFAULT_SERIES_ID instead of the passed
//    seriesId -> the "book carries the routed series" assertion RED.
//  M-fresh-empty: createFreshUniverse leaks a universe_id (e.g. stamps
//    DEFAULT_UNIVERSE_ID on the series) -> fresh universe is no longer isolated;
//    but the load-bearing empty-wiki lock is loadWikiSnapshot(newUni) === 0.
//
// SHARED-DB HYGIENE: ids are `test-f7s3-<uuid>`; every created row (books,
// series, universes) is hard-deleted in afterAll in FK order (book -> series ->
// universe). universe-1 / series-1 / book-1 are never touched.
// -----------------------------------------------------------------------------

loadEnv();

const contSeriesId = `test-f7s3-ser-${randomUUID()}`;
const contBookId = `test-f7s3-bk-${randomUUID()}`;
const freshUniId = `test-f7s3-uni-${randomUUID()}`;
const freshSeriesId = `test-f7s3-ser-${randomUUID()}`;
const freshBookId = `test-f7s3-bk-${randomUUID()}`;
// A series routed under the FRESH (non-default) universe. This is what makes
// insertSeries's universe routing MEASURABLE: routing under universe-1 alone
// cannot distinguish `input.universeId ?? DEFAULT` from a hardcoded DEFAULT.
const routedSeriesId = `test-f7s3-ser-${randomUUID()}`;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterAll(async () => {
  // FK order: books -> series -> universes. Delete continuation + fresh graphs.
  await query(`DELETE FROM books WHERE id = ANY($1)`, [[contBookId, freshBookId]]);
  await query(`DELETE FROM series WHERE id = ANY($1)`, [[contSeriesId, freshSeriesId, routedSeriesId]]);
  await query(`DELETE FROM universes WHERE id = $1`, [freshUniId]);
  await closePool();
});

describe("F7-S3 worlds-hierarchy creation flows (real Postgres)", () => {
  it("CONTINUATION: new series+book route under the EXISTING universe (no canon copy)", async () => {
    const ser = await insertSeries({ id: contSeriesId, name: "Continuation Series", universeId: DEFAULT_UNIVERSE_ID });
    // M-series-route lock: the series carries the ROUTED universe, not some default.
    expect(ser.universeId).toBe(DEFAULT_UNIVERSE_ID);
    const dbSer = await one<{ universe_id: string }>(
      `SELECT universe_id FROM series WHERE id = $1`,
      [contSeriesId],
    );
    expect(dbSer?.universe_id).toBe(DEFAULT_UNIVERSE_ID);

    const bk = await insertBook({ id: contBookId, name: "Continuation Book", seriesId: contSeriesId });
    // M-book-route lock: the book carries the ROUTED series, not the default series-1.
    expect(bk.seriesId).toBe(contSeriesId);
    expect(bk.seriesId).not.toBe(DEFAULT_SERIES_ID);
    const dbBk = await one<{ series_id: string }>(
      `SELECT series_id FROM books WHERE id = $1`,
      [contBookId],
    );
    expect(dbBk?.series_id).toBe(contSeriesId);
  });

  it("CONTINUATION: new book reuses U1 canon by construction, starts at chapter 1", async () => {
    // The new book is under U1, so a U1-scoped snapshot still sees the SEEDED
    // U1 canon entries (canon is universe-level; NO row was copied into the book).
    const snap = await loadWikiSnapshot(DEFAULT_UNIVERSE_ID, contBookId);
    expect(snap.entries.length).toBeGreaterThan(0); // U1 canon visible from the new book
    // Empty book -> numbering restarts at 1 (per-book MAX+1). Locks the S2 invariant.
    const next = await getNextChapterNumber(contBookId);
    expect(next).toBe(1);
  });

  it("FRESH: new universe has an EMPTY wiki by construction; its book starts at chapter 1", async () => {
    const res = await createFreshUniverse({
      universeId: freshUniId,
      seriesId: freshSeriesId,
      bookId: freshBookId,
      universeName: "Fresh World",
    });
    // Structural rows created and correctly linked (routing, not copy).
    expect(res.universe.id).toBe(freshUniId);
    expect(res.series.universeId).toBe(freshUniId);
    expect(res.book.seriesId).toBe(freshSeriesId);

    // M-fresh-empty lock: a brand-new universe carries NO entries. If the fresh
    // flow leaked U1's universe_id (or copied canon), this snapshot would be
    // non-empty. It must be exactly zero.
    const snap = await loadWikiSnapshot(freshUniId, freshBookId);
    expect(snap.entries.length).toBe(0);

    // New book under the fresh series -> chapter numbering starts at 1.
    const next = await getNextChapterNumber(freshBookId);
    expect(next).toBe(1);

    // M-series-route lock: insertSeries must carry the ROUTED universe, not a
    // hardcoded DEFAULT. Routing under a NON-default universe (the fresh one) is
    // what makes this measurable — universe-1 alone can't distinguish
    // `input.universeId ?? DEFAULT` from a hardcoded DEFAULT. Mutating
    // insertSeries's universeId -> DEFAULT_UNIVERSE_ID makes both asserts RED.
    const routedSer = await insertSeries({
      id: routedSeriesId,
      name: "Routed Under Fresh",
      universeId: freshUniId,
    });
    expect(routedSer.universeId).toBe(freshUniId);
    expect(routedSer.universeId).not.toBe(DEFAULT_UNIVERSE_ID);
    const dbRoutedSer = await one<{ universe_id: string }>(
      `SELECT universe_id FROM series WHERE id = $1`,
      [routedSeriesId],
    );
    expect(dbRoutedSer?.universe_id).toBe(freshUniId);
    expect(dbRoutedSer?.universe_id).not.toBe(DEFAULT_UNIVERSE_ID);
  });
});
