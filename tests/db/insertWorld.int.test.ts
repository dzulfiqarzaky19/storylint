import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { insertWorld } from "@/lib/db/mutations";
import { getWorldTree } from "@/lib/db/queries";

// -----------------------------------------------------------------------------
// TCK-022 (W-4a) — insertWorld + getWorldTree (INTEGRATION, real Postgres).
//
// insertWorld creates a SECOND (or Nth) world inside an existing universe, plus
// its OWN first series + first book, in ONE transaction (books still carries
// series_id until W-6, so a world needs a series+book home for chapters).
//
// This test stands up a THROWAWAY universe (test-tck022-u-<uuid>), inserts two
// worlds into it, and proves:
//   A. insertWorld lands the world row AND its book row (its home for chapters).
//   B. the tx is ATOMIC: a failing series/book insert rolls back the world row.
//   C. getWorldTree returns THIS universe's worlds ordered by sort_order.
//
// MUTATION (run manually at ready, per the moderate gate):
//   - A/book: drop the `INSERT INTO books ...` line in insertWorld -> assertion A
//     (book exists) goes RED.
//   - B/atomic: replace `withTransaction` body so the world insert is NOT rolled
//     back on a later failure -> assertion B (world absent after failure) RED.
//   - C/order: mutate getWorldTree's `ORDER BY sort_order, id` on worlds to
//     `ORDER BY id` (or drop it) -> the ordered-worlds assertion goes RED.
//
// SHARED-DB HYGIENE: all ids are `test-tck022-*`; the whole fixture (worlds,
// series, books, the universe) is hard-deleted in afterAll in FK order. The
// seeded universe-1 / world-universe-1 are never touched.
// -----------------------------------------------------------------------------

loadEnv();

const UNI = `test-tck022-u-${randomUUID()}`;
// The worlds we create; recorded so afterAll can clean up their series+books.
const worldIds: string[] = [];
const seriesIds: string[] = [];
const bookIds: string[] = [];

function mkWorld(sortOrder: number, title: string) {
  const id = `test-tck022-w-${randomUUID()}`;
  const seriesId = `test-tck022-s-${randomUUID()}`;
  const bookId = `test-tck022-b-${randomUUID()}`;
  worldIds.push(id);
  seriesIds.push(seriesId);
  bookIds.push(bookId);
  return { id, universeId: UNI, title, seriesId, bookId, sortOrder };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  await query(`INSERT INTO universes (id, name) VALUES ($1, 'TCK022 Universe')`, [UNI]);
});

afterAll(async () => {
  // FK order: books -> series -> worlds -> universe. Delete by our test ids only.
  if (bookIds.length) await query(`DELETE FROM books WHERE id = ANY($1)`, [bookIds]);
  if (seriesIds.length) await query(`DELETE FROM series WHERE id = ANY($1)`, [seriesIds]);
  if (worldIds.length) await query(`DELETE FROM worlds WHERE id = ANY($1)`, [worldIds]);
  await query(`DELETE FROM series WHERE universe_id = $1`, [UNI]);
  await query(`DELETE FROM worlds WHERE universe_id = $1`, [UNI]);
  await query(`DELETE FROM universes WHERE id = $1`, [UNI]);
  await closePool();
});

describe("TCK-022 insertWorld (real Postgres)", () => {
  it("A: creates the world row AND its first book (a home for chapters), in the universe", async () => {
    const w = mkWorld(0, "World One");
    const row = await insertWorld(w);
    expect(row.id).toBe(w.id);
    expect(row.universeId).toBe(UNI);
    expect(row.title).toBe("World One");

    // The world row is persisted.
    const worlds = await query<{ id: string }>(`SELECT id FROM worlds WHERE id = $1`, [w.id]);
    expect(worlds.rowCount).toBe(1);

    // Its own series + book landed in the SAME tx (the chapter home).
    const series = await query<{ id: string }>(`SELECT id FROM series WHERE id = $1`, [w.seriesId]);
    expect(series.rowCount).toBe(1);
    const books = await query<{ series_id: string }>(
      `SELECT series_id FROM books WHERE id = $1`,
      [w.bookId],
    );
    expect(books.rowCount).toBe(1);
    expect(books.rows[0]!.series_id).toBe(w.seriesId); // the book hangs off its world's series
  });

  it("B: is atomic — a duplicate series id (PK violation) rolls back the world row", async () => {
    const first = mkWorld(1, "Atomic First");
    await insertWorld(first);

    // Reuse the SAME series id -> the series INSERT (second statement in the tx)
    // PK-violates, so the whole tx (incl. the world row) must roll back.
    const clashWorldId = `test-tck022-w-${randomUUID()}`;
    worldIds.push(clashWorldId);
    await expect(
      insertWorld({
        id: clashWorldId,
        universeId: UNI,
        title: "Atomic Clash",
        seriesId: first.seriesId, // duplicate PK -> forced failure
        bookId: `test-tck022-b-${randomUUID()}`,
        sortOrder: 2,
      }),
    ).rejects.toThrow();

    // The world row from the FAILED insert must NOT exist (rolled back).
    const orphan = await query<{ id: string }>(`SELECT id FROM worlds WHERE id = $1`, [clashWorldId]);
    expect(orphan.rowCount).toBe(0);
  });
});

describe("TCK-022 getWorldTree (real Postgres)", () => {
  it("C: returns the universe's worlds ordered by sort_order", async () => {
    // Insert two more worlds OUT OF sort order (b before a) so the ordering is
    // proven, not accidentally satisfied by insertion order.
    const later = mkWorld(20, "Zed World");
    const earlier = mkWorld(10, "Alpha World");
    await insertWorld(later);
    await insertWorld(earlier);

    const tree = await getWorldTree();
    const node = tree.find((u) => u.id === UNI);
    expect(node).toBeDefined();

    const orderedTitles = node!.worlds.map((w) => w.title);
    // Alpha (sort 10) must precede Zed (sort 20) despite Zed being inserted first.
    const alphaIdx = orderedTitles.indexOf("Alpha World");
    const zedIdx = orderedTitles.indexOf("Zed World");
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(zedIdx).toBeGreaterThanOrEqual(0);
    expect(alphaIdx).toBeLessThan(zedIdx);

    // The node carries {id,title} shape and includes the world we created.
    expect(node!.worlds.some((w) => w.id === earlier.id && w.title === "Alpha World")).toBe(true);
  });

  it("only lists worlds belonging to THIS universe (no cross-universe bleed)", async () => {
    const tree = await getWorldTree();
    const node = tree.find((u) => u.id === UNI);
    expect(node).toBeDefined();
    // Every world on this node has our universe (getWorldTree groups by universeId).
    const ids = node!.worlds.map((w) => w.id);
    expect(ids.every((id) => worldIds.includes(id))).toBe(true);
  });
});
