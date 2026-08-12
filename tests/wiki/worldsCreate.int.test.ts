import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, one, closePool } from "@/lib/db/pool";
import { loadWikiSnapshot } from "@/lib/db/queries";
import {
  insertWorld,
  insertBook,
  createFreshUniverse,
  getNextChapterNumber,
} from "@/lib/db/mutations";
import { DEFAULT_UNIVERSE_ID, DEFAULT_WORLD_ID } from "@/lib/db/scope";

// -----------------------------------------------------------------------------
// F7-S3 / W-6 — worlds-hierarchy CREATION FLOWS (INTEGRATION, real Postgres).
//
// Structural creation of World/Book/Universe. Continuation-vs-fresh is pure
// ROUTING (ratified by chick, data-model gate): no canon row-copy. W-6: series is
// gone — a book hangs off a WORLD directly (books.world_id).
//
//  - CONTINUATION: insertWorld(under U1) + insertBook(under that world) stamp
//    the routed universe_id/world_id (NOT a hardcoded default). A book created
//    under U1 reuses U1's canon by construction — loadWikiSnapshot(U1, newBook)
//    still sees the SEEDED U1 entries (canon is universe-level, canon facts/ties
//    carry book_id=NULL). getNextChapterNumber(newBook)=1 (empty book).
//
//  - FRESH: createFreshUniverse mints a NEW universe + first world + first book
//    in one txn. Its wiki is EMPTY by construction — loadWikiSnapshot(newUni,
//    newBook) returns ZERO entries — because no entries carry the new universe_id.
//    The new book's getNextChapterNumber=1.
//
// MUTATIONS this locks:
//  M-world-route: insertWorld stamps DEFAULT_UNIVERSE_ID instead of the passed
//    universeId -> the "world carries the routed universe" assertion RED.
//  M-book-route: insertBook stamps DEFAULT_WORLD_ID instead of the passed
//    worldId -> the "book carries the routed world" assertion RED.
//  M-fresh-empty: createFreshUniverse leaks a universe_id (e.g. stamps
//    DEFAULT_UNIVERSE_ID on the world) -> fresh universe is no longer isolated;
//    but the load-bearing empty-wiki lock is loadWikiSnapshot(newUni) === 0.
//
// SHARED-DB HYGIENE: ids are `test-f7s3-<uuid>`; every created row (books,
// worlds, universes) is hard-deleted in afterAll in FK order (book -> world ->
// universe). universe-1 / world-universe-1 / book-1 are never touched.
// -----------------------------------------------------------------------------

loadEnv();

const contWorldId = `test-f7s3-wr-${randomUUID()}`;
const contBookId = `test-f7s3-bk-${randomUUID()}`;
const freshUniId = `test-f7s3-uni-${randomUUID()}`;
const freshWorldId = `test-f7s3-wr-${randomUUID()}`;
const freshBookId = `test-f7s3-bk-${randomUUID()}`;
// A world routed under the FRESH (non-default) universe. This is what makes
// insertWorld's universe routing MEASURABLE: routing under universe-1 alone
// cannot distinguish `input.universeId ?? DEFAULT` from a hardcoded DEFAULT.
const routedWorldId = `test-f7s3-wr-${randomUUID()}`;
const routedWorldBookId = `test-f7s3-bk-${randomUUID()}`;
// A book inserted with worldId OMITTED — locks that the CONTINUATION default homes
// it onto DEFAULT_WORLD_ID ('world-universe-1'), the seeded default world.
const defaultRouteBookId = `test-f7s3-bk-${randomUUID()}`;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterAll(async () => {
  // FK order: books -> worlds -> universes. Delete continuation + fresh graphs
  // (insertWorld mints its own book, so clear every book under our worlds first).
  const worlds = [contWorldId, freshWorldId, routedWorldId];
  await query(`DELETE FROM books WHERE world_id = ANY($1)`, [worlds]);
  await query(`DELETE FROM books WHERE id = ANY($1)`, [[contBookId, freshBookId, routedWorldBookId]]);
  // The default-route book homes onto the SEEDED default world (world-universe-1),
  // which our world-scoped sweep never lists — delete it by id so the baseline
  // (book-1 only under world-universe-1) is restored.
  await query(`DELETE FROM books WHERE id = ANY($1)`, [[defaultRouteBookId]]);
  // The (d) test pre-seeds a decoy world under universe-1 so a bogus-default
  // mutation surfaces as a value mismatch (not an FK crash). Sweep it so the
  // baseline stays world-universe-1 only under universe-1.
  await query(`DELETE FROM worlds WHERE id = $1`, [`world-BOGUS-${DEFAULT_UNIVERSE_ID}`]);
  await query(`DELETE FROM worlds WHERE id = ANY($1)`, [worlds]);
  await query(`DELETE FROM universes WHERE id = $1`, [freshUniId]);
  await closePool();
});

describe("F7-S3/W-6 worlds-hierarchy creation flows (real Postgres)", () => {
  it("CONTINUATION: new world+book route under the EXISTING universe (no canon copy)", async () => {
    const wr = await insertWorld({
      id: contWorldId,
      universeId: DEFAULT_UNIVERSE_ID,
      title: "Continuation World",
      bookId: `test-f7s3-bk-${randomUUID()}`,
    });
    // M-world-route lock: the world carries the ROUTED universe, not some default.
    expect(wr.universeId).toBe(DEFAULT_UNIVERSE_ID);
    const dbWr = await one<{ universe_id: string }>(
      `SELECT universe_id FROM worlds WHERE id = $1`,
      [contWorldId],
    );
    expect(dbWr?.universe_id).toBe(DEFAULT_UNIVERSE_ID);

    const bk = await insertBook({ id: contBookId, name: "Continuation Book", worldId: contWorldId });
    // M-book-route lock: the book carries the ROUTED world, not the default world.
    expect(bk.worldId).toBe(contWorldId);
    expect(bk.worldId).not.toBe(DEFAULT_WORLD_ID);
    const dbBk = await one<{ world_id: string }>(
      `SELECT world_id FROM books WHERE id = $1`,
      [contBookId],
    );
    expect(dbBk?.world_id).toBe(contWorldId);
  });

  it("DEFAULT ROUTE: insertBook with worldId OMITTED homes the book onto DEFAULT_WORLD_ID", async () => {
    // (d) The CONTINUATION default: when no worldId is passed, insertBook stamps
    // DEFAULT_WORLD_ID (`world-${DEFAULT_UNIVERSE_ID}` = 'world-universe-1'), the
    // seeded default world. A mis-set DEFAULT_WORLD_ID silently mis-homes EVERY
    // continuation book, so this asserts the POSITIVE identity of the stamped world
    // (read back from the DB) — not `.not.toBe(...)`.
    //
    // SEMANTIC (not FK) lock: mutating DEFAULT_WORLD_ID to a BOGUS id would
    // normally make insertBook's FK write CRASH (the bogus world does not exist),
    // giving an INCIDENTAL failure that doesn't isolate the default. To force the
    // failure to surface as a SEMANTIC mismatch on the read-back value, we pre-seed
    // a REAL decoy world at the exact id a `world-BOGUS-${universe}` mutation would
    // resolve to. Under the intact constant the decoy is unused and the book homes
    // onto world-universe-1 (GREEN). Under the mutation the book homes onto the
    // (now-existing) decoy, the FK write SUCCEEDS, and the read-back is
    // 'world-BOGUS-universe-1' !== 'world-universe-1' -> the assertion goes RED as a
    // value mismatch, exactly what a mis-set default does in production.
    await query(
      `INSERT INTO worlds (id, universe_id, title, sort_order)
         VALUES ($1, $2, 'Default-Route Decoy', 99)
       ON CONFLICT (id) DO NOTHING`,
      [`world-BOGUS-${DEFAULT_UNIVERSE_ID}`, DEFAULT_UNIVERSE_ID],
    );

    const bk = await insertBook({ id: defaultRouteBookId, name: "Default-Route Book" });
    // The value insertBook resolved for the omitted worldId is exactly the default.
    expect(bk.worldId).toBe(DEFAULT_WORLD_ID);
    expect(bk.worldId).toBe("world-universe-1"); // the literal DEFAULT_WORLD_ID target
    // And the row PERSISTED that home (read back straight from the DB).
    const dbDefault = await one<{ world_id: string }>(
      `SELECT world_id FROM books WHERE id = $1`,
      [defaultRouteBookId],
    );
    expect(dbDefault?.world_id).toBe("world-universe-1");
  });

  it("CONTINUATION: new book reuses U1 canon by construction, starts at chapter 1", async () => {
    // The new book is under a world in U1, so a U1-scoped snapshot still sees the
    // SEEDED U1 canon entries (canon is universe-level; NO row was copied).
    const snap = await loadWikiSnapshot(DEFAULT_UNIVERSE_ID, contBookId);
    expect(snap.entries.length).toBeGreaterThan(0); // U1 canon visible from the new book
    // Empty book -> numbering restarts at 1 (per-book MAX+1). Locks the S2 invariant.
    const next = await getNextChapterNumber(contBookId);
    expect(next).toBe(1);
  });

  it("FRESH: new universe has an EMPTY wiki by construction; its book starts at chapter 1", async () => {
    const res = await createFreshUniverse({
      universeId: freshUniId,
      worldId: freshWorldId,
      bookId: freshBookId,
      universeName: "Fresh World",
    });
    // Structural rows created and correctly linked (routing, not copy).
    expect(res.universe.id).toBe(freshUniId);
    expect(res.world.universeId).toBe(freshUniId);
    expect(res.book.worldId).toBe(freshWorldId);

    // M-fresh-empty lock: a brand-new universe carries NO entries. If the fresh
    // flow leaked U1's universe_id (or copied canon), this snapshot would be
    // non-empty. It must be exactly zero.
    const snap = await loadWikiSnapshot(freshUniId, freshBookId);
    expect(snap.entries.length).toBe(0);

    // New book under the fresh world -> chapter numbering starts at 1.
    const next = await getNextChapterNumber(freshBookId);
    expect(next).toBe(1);

    // M-world-route lock: insertWorld must carry the ROUTED universe, not a
    // hardcoded DEFAULT. Routing under a NON-default universe (the fresh one) is
    // what makes this measurable — universe-1 alone can't distinguish
    // `input.universeId ?? DEFAULT` from a hardcoded DEFAULT. Mutating
    // insertWorld's universeId -> DEFAULT_UNIVERSE_ID makes both asserts RED.
    const routedWr = await insertWorld({
      id: routedWorldId,
      universeId: freshUniId,
      title: "Routed Under Fresh",
      bookId: routedWorldBookId,
    });
    expect(routedWr.universeId).toBe(freshUniId);
    expect(routedWr.universeId).not.toBe(DEFAULT_UNIVERSE_ID);
    const dbRoutedWr = await one<{ universe_id: string }>(
      `SELECT universe_id FROM worlds WHERE id = $1`,
      [routedWorldId],
    );
    expect(dbRoutedWr?.universe_id).toBe(freshUniId);
    expect(dbRoutedWr?.universe_id).not.toBe(DEFAULT_UNIVERSE_ID);
  });
});
