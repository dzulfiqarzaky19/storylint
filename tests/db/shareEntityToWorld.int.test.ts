import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import {
  insertWorld,
  linkEntityToWorld,
  insertEntry,
  unlinkEntityFromWorld,
} from "@/lib/db/mutations";
import { loadWorldSnapshot } from "@/lib/db/queries";
import { confirmWikiWrite } from "@/lib/actions/confirmation";

// -----------------------------------------------------------------------------
// TCK-023 (W-4b) — linkEntityToWorld / unlinkEntityFromWorld (the SHARE op),
// INTEGRATION on real Postgres.
//
// world_entities is the M2M membership junction (PRIMARY KEY(world_id,entity_id)).
// An entry stays HOME to its universe; world membership is ADDITIVE via a link
// row, so a shared entity appears in EACH world it is linked to.
//
// This test stands up a THROWAWAY second world (test-tck023-w-<uuid>) INSIDE the
// seeded universe-mol, so the seeded `mol-zorian` entry (home to universe-mol) can be
// linked into it, and proves:
//   A. linkEntityToWorld inserts exactly ONE membership row, and a DOUBLE link is
//      IDEMPOTENT (still exactly one row — ON CONFLICT DO NOTHING).
//   B. a shared entity shows in BOTH worlds' loadWorldSnapshot (home world +
//      the new world), because membership is the world_entities JOIN.
//   C. unlinkEntityFromWorld drops ONLY that one link row (the entity is gone
//      from the new world's snapshot). The entry ROW and its HOME-world
//      membership SURVIVE because the entity STILL HAS its home link — an unlink
//      deletes the entity ONLY when it removes its LAST link (orphan=DELETE-on-
//      last-link); here the home link remains, so she lives.
//   D. unlink of a NON-member is a no-op (0 rows, no throw).
//   E. unlink of an entity's LAST link DELETES the entity ROW itself
//      (orphan=DELETE-on-last-link) — a solo-linked throwaway entity is gone.
//
// SHARED-DB HYGIENE: the throwaway world/book use `test-tck023-*` ids and
// are hard-deleted in afterAll in FK order (its link rows go first). The seeded
// universe-mol / world-mol / `mol-zorian` and the baseline links are NEVER
// mutated destructively: the only baseline row this test touches is the temporary
// (test-world, mol-zorian) link, removed in afterAll. Restores DB to the {MoL,
// 15 links} baseline.
// -----------------------------------------------------------------------------

loadEnv();

const HOME_WORLD = "world-mol"; // seeded world (home to universe-mol)
const HOME_UNIVERSE = "universe-mol";
const HOME_BOOK = "book-mol-1"; // seeded first book (the as-of-N window anchor)
const ENTITY = "mol-zorian"; // seeded entry, home to universe-mol

// Throwaway SECOND world in the SAME universe (so its snapshot window resolves to
// its own book, and mol-zorian can be linked into it as a shared member).
const NEW_WORLD = `test-tck023-w-${randomUUID()}`;
const NEW_BOOK = `test-tck023-b-${randomUUID()}`;
// A throwaway entity linked ONLY to NEW_WORLD, to prove DELETE-on-last-link (Test E).
const SOLO_ENTITY = `test-tck023-ent-${randomUUID()}`;
const confirm = confirmWikiWrite({ confirmed: true });

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  await insertWorld({
    id: NEW_WORLD,
    universeId: HOME_UNIVERSE,
    title: "TCK023 Shared World",
    bookId: NEW_BOOK,
  });
});

afterAll(async () => {
  // Remove any link this test made from the NEW world (and defensively any stray
  // test link on mol-zorian into the new world), then tear down the throwaway world
  // subtree in FK order (its own links -> book -> world).
  await query(`DELETE FROM world_entities WHERE world_id = $1`, [NEW_WORLD]);
  await query(`DELETE FROM entries WHERE id = $1`, [SOLO_ENTITY]);
  await query(`DELETE FROM books WHERE id = $1`, [NEW_BOOK]);
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
    // Precondition: mol-zorian is NOT yet a member of the new world.
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(0);

    await linkEntityToWorld(NEW_WORLD, ENTITY);
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(1);

    // Double-link must NOT create a second row (ON CONFLICT DO NOTHING).
    await linkEntityToWorld(NEW_WORLD, ENTITY);
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(1);
  });

  it("B: a shared entity shows in BOTH worlds' loadWorldSnapshot", async () => {
    // mol-zorian is now linked into the new world (from test A) AND is a seeded member
    // of her home world. She must render in BOTH snapshots.
    const homeSnap = await loadWorldSnapshot(HOME_WORLD, HOME_BOOK);
    const newSnap = await loadWorldSnapshot(NEW_WORLD, NEW_BOOK);

    expect(homeSnap.entries.some((e) => e.id === ENTITY)).toBe(true);
    expect(newSnap.entries.some((e) => e.id === ENTITY)).toBe(true);
  });
});

describe("TCK-023 unlinkEntityFromWorld (real Postgres)", () => {
  it("C: unlink drops only that one link; the entity row and its home membership survive", async () => {
    // Ensure mol-zorian is linked into the new world first (independent of test order).
    await linkEntityToWorld(NEW_WORLD, ENTITY);
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(1);

    await unlinkEntityFromWorld(NEW_WORLD, ENTITY);

    // Gone from the new world...
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(0);
    const newSnap = await loadWorldSnapshot(NEW_WORLD, NEW_BOOK);
    expect(newSnap.entries.some((e) => e.id === ENTITY)).toBe(false);

    // ...but the entity ROW still exists (her HOME link remains, so the unlink was
    // NOT her last link) and her HOME membership is intact (only new-world link dropped).
    const row = await query<{ id: string }>(`SELECT id FROM entries WHERE id = $1`, [ENTITY]);
    expect(row.rowCount).toBe(1);
    expect(await linkCount(HOME_WORLD, ENTITY)).toBe(1);
    const homeSnap = await loadWorldSnapshot(HOME_WORLD, HOME_BOOK);
    expect(homeSnap.entries.some((e) => e.id === ENTITY)).toBe(true);
  });

  it("D: unlink of a non-member is a no-op (0 rows removed, no throw)", async () => {
    // mol-zorian is not a member of the new world here (test C removed her).
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(0);
    await expect(unlinkEntityFromWorld(NEW_WORLD, ENTITY)).resolves.toBeUndefined();
    expect(await linkCount(NEW_WORLD, ENTITY)).toBe(0);
  });

  it("E: unlink of the LAST link DELETES the entity (orphan=DELETE-on-last-link)", async () => {
    // A fresh entity linked ONLY to NEW_WORLD: this world is its sole membership.
    await insertEntry(
      { id: SOLO_ENTITY, kind: "character", name: "Solo One", catalogueNo: "TCK023-E", note: "", summary: "", shelf: "characters", sortOrder: 0, universeId: HOME_UNIVERSE },
      confirm,
    );
    await linkEntityToWorld(NEW_WORLD, SOLO_ENTITY);
    expect(await linkCount(NEW_WORLD, SOLO_ENTITY)).toBe(1);

    // Unlinking its LAST world membership removes the entity ROW itself.
    await unlinkEntityFromWorld(NEW_WORLD, SOLO_ENTITY);
    expect(await linkCount(NEW_WORLD, SOLO_ENTITY)).toBe(0);
    const row = await query<{ id: string }>(`SELECT id FROM entries WHERE id = $1`, [SOLO_ENTITY]);
    expect(row.rowCount).toBe(0);
  });
});
