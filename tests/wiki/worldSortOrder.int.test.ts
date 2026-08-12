import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { createWorld } from "@/lib/actions/wiki";
import { getWorldTree } from "@/lib/db/queries";
import { resolveWikiScope } from "@/app/wiki/scope";

// -----------------------------------------------------------------------------
// TCK-E08 — new worlds must NOT collide with the seed at sort_order 0 (INTEGRATION,
// real Postgres).
//
// BUG: createWorld (wiki.ts) omits sortOrder, so insertWorld's `?? 0` fallback
// lands EVERY `+ world` at sort_order 0 — the same as a universe's FIRST (seed-like)
// world. getWorldTree ORDER BY sort_order, id then tiebreaks on the random UUID, so
// resolveWikiScope's default `worlds[0]` picks the lexically-smallest UUID instead
// of the universe's first/seed world. Bare /wiki then lands on the WRONG world.
//
// This test stands up a THROWAWAY universe with a seed-like first world at
// sort_order 0, mints TWO more worlds via createWorld, and proves:
//   A. the two new worlds get DISTINCT, MONOTONIC sort_orders both > 0 (1 and 2),
//      never colliding at 0.
//   B. the universe's default world (getWorldTree worlds[0] == resolveWikiScope
//      default activeWorldId with no `?w=`) is STILL the sort-0 first world,
//      regardless of the new worlds' UUIDs.
//
// MUTATION (moderate gate): revert insertWorld's default to `input.sortOrder ?? 0`
// -> both new worlds land at 0 -> UUID lexical tiebreak -> worlds[0] becomes a
// random new world -> assertion B ("default == first world") goes RED.
//
// SHARED-DB HYGIENE: all ids are `test-e08-*`; the whole fixture (books, worlds,
// the universe) is hard-deleted in afterAll in FK order. The seeded universe-1 /
// world-universe-1 are NEVER touched.
// -----------------------------------------------------------------------------

loadEnv();

const UNI = `test-e08-u-${randomUUID()}`;
// A seed-like FIRST world at sort_order 0 (mimics world-universe-1). Its id is
// deliberately prefixed `zzz` so it sorts LEXICALLY LAST among this universe's
// worlds. That way ONLY sort_order can put it first: with the fix (seed=0, new
// worlds=1,2) sort_order wins and the seed leads; under the collision bug (all 0)
// the `ORDER BY sort_order, id` tiebreak on id demotes this `zzz` seed BELOW the
// new worlds, so worlds[0] becomes a new world and the default-pick assertion goes
// RED deterministically (never a coin-flip on random UUID ordering).
const seedWorldId = `test-e08-zzz-w0-${randomUUID()}`;
const seedBookId = `test-e08-b0-${randomUUID()}`;
// New worlds minted via createWorld (ids are server-generated randomUUIDs).
const newWorldIds: string[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  await query(`INSERT INTO universes (id, name) VALUES ($1, 'E08 Universe')`, [UNI]);
  // Seed-like first world at sort_order 0, plus its book (FK home for chapters).
  await query(
    `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ($1, $2, 'E08 Seed World', 0)`,
    [seedWorldId, UNI],
  );
  await query(
    `INSERT INTO books (id, world_id, name, sort_order) VALUES ($1, $2, 'E08 Seed Book', 0)`,
    [seedBookId, seedWorldId],
  );
});

afterAll(async () => {
  // FK order: books -> worlds -> universe. Delete only rows under THIS universe.
  await query(`DELETE FROM books WHERE world_id IN (SELECT id FROM worlds WHERE universe_id = $1)`, [UNI]);
  await query(`DELETE FROM worlds WHERE universe_id = $1`, [UNI]);
  await query(`DELETE FROM universes WHERE id = $1`, [UNI]);
  await closePool();
});

describe("TCK-E08 createWorld sort_order (real Postgres)", () => {
  it("mints new worlds with distinct monotonic sort_orders that never collide with the seed's 0", async () => {
    const first = await createWorld({ worldName: "E08 New World A", universeId: UNI });
    expect(first.ok).toBe(true);
    const second = await createWorld({ worldName: "E08 New World B", universeId: UNI });
    expect(second.ok).toBe(true);
    if (first.ok) newWorldIds.push(first.data.worldId);
    if (second.ok) newWorldIds.push(second.data.worldId);

    const orders = await query<{ id: string; sort_order: number }>(
      `SELECT id, sort_order FROM worlds WHERE universe_id = $1 ORDER BY sort_order, id`,
      [UNI],
    );
    // Seed(0) then the two new worlds at DISTINCT, monotonic, > 0 sort_orders.
    const sortOrders = orders.rows.map((r) => r.sort_order);
    expect(sortOrders).toEqual([0, 1, 2]);
    // Every new world is strictly after the seed (its sort_order > 0).
    const newRows = orders.rows.filter((r) => r.id !== seedWorldId);
    expect(newRows.every((r) => r.sort_order > 0)).toBe(true);
  });

  it("keeps the seed-like first world as the default pick (getWorldTree[0] == resolveWikiScope default), not a random UUID", async () => {
    const tree = await getWorldTree();
    const node = tree.find((u) => u.id === UNI);
    expect(node).toBeDefined();

    // getWorldTree orders by sort_order then id: the sort-0 seed world must be first.
    expect(node!.worlds[0]!.id).toBe(seedWorldId);

    // resolveWikiScope's default (no `?w=`) picks that universe's worlds[0] — it MUST
    // be the seed world, not the lexically-smallest new-world UUID.
    const scope = resolveWikiScope(tree, UNI, undefined);
    expect(scope.activeWorldId).toBe(seedWorldId);
  });
});
