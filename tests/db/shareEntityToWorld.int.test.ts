import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import {
  insertWorld,
  linkEntityToWorld,
  unlinkEntityFromWorld,
} from "@/lib/db/mutations";
import { loadWorldSnapshot } from "@/lib/db/queries";

// -----------------------------------------------------------------------------
// TCK-023 (W-4b) — linkEntityToWorld / unlinkEntityFromWorld (the SHARE op),
// INTEGRATION on real Postgres.
//
// world_entities is the M2M membership junction (PRIMARY KEY(world_id,entity_id)).
// An entry stays HOME to its universe; world membership is ADDITIVE via a link
// row, so a shared entity appears in EACH world it is linked to.
//
// This test stands up a THROWAWAY second world (test-tck023-w-<uuid>) INSIDE the
// seeded universe-1, so the seeded `maren` entry (home to universe-1) can be
// linked into it, and proves:
//   A. linkEntityToWorld inserts exactly ONE membership row, and a DOUBLE link is
//      IDEMPOTENT (still exactly one row — ON CONFLICT DO NOTHING).
//   B. a shared entity shows in BOTH worlds' loadWorldSnapshot (home world +
//      the new world), because membership is the world_entities JOIN.
//   C. unlinkEntityFromWorld drops ONLY that one link row (the entity is gone
//      from the new world's snapshot) while the entry ROW and its HOME-world
//      membership SURVIVE (orphan = LEAVE — never delete the entity).
//   D. unlink of a NON-member is a no-op (0 rows, no throw).
//
// SHARED-DB HYGIENE: the throwaway world/series/book use `test-tck023-*` ids and
// are hard-deleted in afterAll in FK order (its link rows go first). The seeded
// universe-1 / world-universe-1 / `maren` and the 15 baseline links are NEVER
// mutated destructively: the only baseline row this test touches is the temporary
// (test-world, maren) link, removed in afterAll. Restores DB to the {Ashkeld,
// 15 links} baseline.
// -----------------------------------------------------------------------------

loadEnv();

const HOME_WORLD = "world-universe-1"; // seeded world (home to universe-1)
const HOME_UNIVERSE = "universe-1";
const HOME_BOOK = "book-1"; // seeded first book (the as-of-N window anchor)
const ENTITY = "maren"; // seeded entry, home to universe-1

// Throwaway SECOND world in the SAME universe (so its snapshot window resolves to
// its own book, and maren can be linked into it as a shared member).
const NEW_WORLD = `test-tck023-w-${randomUUID()}`;
const NEW_SERIES = `test-tck023-s-${randomUUID()}`;
const NEW_BOOK = `test-tck023-b-${randomUUID()}`;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  await insertWorld({
    id: NEW_WORLD,
    universeId: HOME_UNIVERSE,
    title: "TCK023 Shared World",
    seriesId: NEW_SERIES,
    bookId: NEW_BOOK,
  });
});

afterAll(async () => {
  // Remove any link this test made from the NEW world (and defensively any stray
  // test link on maren into the new world), then tear down the throwaway world
  // subtree in FK order (its own links -> book -> series -> world).
  await query(`DELETE FROM world_entities WHERE world_id = $1`, [NEW_WORLD]);
  await query(`DELETE FROM books WHERE id = $1`, [NEW_BOOK]);
  await query(`DELETE FROM series WHERE id = $1`, [NEW_SERIES]);
  await query(`DELETE FROM worlds WHERE id = $1`, [NEW_WORLD]);
  await closePool();
});

async function linkCount(worldId: string, entityId: string): Promise<number> {
  const r = await query<{ n: string }>(
    `SELECT COUNT(*)::int AS n FROM world_entities WHERE world_id = $1 AND entity_id = $2`,
    [worldId, entityId],
  );
  return Number(r.rows[0]!.n);
}

describe("TCK-023 linkEntityToWorld (real Postgres)", () => {
  it("A: a single link inserts exactly one membership row; a double link is idempotent", async () => {
    // Precondition: maren is NOT yet a member of the new world.
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(0);

    await linkEntityToWorld(NEW_WORLD, ENTITY);
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(1);

    // Double-link must NOT create a second row (ON CONFLICT DO NOTHING).
    await linkEntityToWorld(NEW_WORLD, ENTITY);
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(1);
  });

  it("B: a shared entity shows in BOTH worlds' loadWorldSnapshot", async () => {
    // maren is now linked into the new world (from test A) AND is a seeded member
    // of her home world. She must render in BOTH snapshots.
    const homeSnap = await loadWorldSnapshot(HOME_WORLD, HOME_BOOK);
    const newSnap = await loadWorldSnapshot(NEW_WORLD, NEW_BOOK);

    expect(homeSnap.entries.some((e) => e.id === ENTITY)).toBe(true);
    expect(newSnap.entries.some((e) => e.id === ENTITY)).toBe(true);
  });
});

describe("TCK-023 unlinkEntityFromWorld (real Postgres)", () => {
  it("C: unlink drops only that one link; the entity row and its home membership survive", async () => {
    // Ensure maren is linked into the new world first (independent of test order).
    await linkEntityToWorld(NEW_WORLD, ENTITY);
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(1);

    await unlinkEntityFromWorld(NEW_WORLD, ENTITY);

    // Gone from the new world...
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(0);
    const newSnap = await loadWorldSnapshot(NEW_WORLD, NEW_BOOK);
    expect(newSnap.entries.some((e) => e.id === ENTITY)).toBe(false);

    // ...but the entity ROW still exists (never deleted) and her HOME membership
    // is intact (only the new-world link was dropped).
    const row = await query<{ id: string }>(`SELECT id FROM entries WHERE id = $1`, [ENTITY]);
    expect(row.rowCount).toBe(1);
    expect(await linkCount(HOME_WORLD, ENTITY)).toBe(1);
    const homeSnap = await loadWorldSnapshot(HOME_WORLD, HOME_BOOK);
    expect(homeSnap.entries.some((e) => e.id === ENTITY)).toBe(true);
  });

  it("D: unlink of a non-member is a no-op (0 rows removed, no throw)", async () => {
    // maren is not a member of the new world here (test C removed her).
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(0);
    await expect(unlinkEntityFromWorld(NEW_WORLD, ENTITY)).resolves.toBeUndefined();
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(0);
  });
});
