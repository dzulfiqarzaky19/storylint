import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, rows, one, closePool } from "@/lib/db/pool";
import { migrate, down } from "@/lib/db/migrations/w1-worlds-expand.mjs";
// W-6 hung books.world_id -> worlds(id) ON DELETE CASCADE off the worlds table
// this migration owns. W-1's down() legitimately owns ONLY its own objects
// (worlds/world_entities/categories.world_id) and drops them WITHOUT CASCADE, so a
// global W-1 down can only run once the later W-6 layer is reversed first. The
// global-down test below reverses the whole stack it depends on (w6b -> w6a -> W-1),
// then restores it (W-1 -> w6a -> w6b), leaving the shared DB at the W-6 target for
// any later serial int file.
import { migrate as w6aUp, down as w6aDown } from "@/lib/db/migrations/w6a-books-world-expand.mjs";
import { migrate as w6bUp, down as w6bDown } from "@/lib/db/migrations/w6b-series-contract.mjs";

loadEnv();

// -----------------------------------------------------------------------------
// W-1 (world-model epic) — WORLDS-MEMBERSHIP EXPAND migration (INTEGRATION,
// real Postgres). Proves the additive migration builds the new objects and
// backfills membership PER-ROW, and that its down-migration round-trips without
// losing links or re-homing an entry.
//
// GATE (mizaru's signed 8-pt bar, narrowed to W-1's additive surface):
//  - pt5 per-row backfill (amend A): a TWO-universe throwaway fixture (the live
//    baseline has only universe-1, so a single-universe assertion can't tell
//    `link to world-of(entry.universe)` apart from a hardcoded constant). Each
//    test entry — INCLUDING a tombstoned one — must link EXACTLY its OWN
//    universe's world. The load-bearing mutation: change the B2 backfill JOIN in
//    w1-worlds-expand.mts so it links to the WRONG universe's world (e.g.
//    `'world-' || e.universe_id` -> a constant) and the per-ENTRY assertion below
//    (not an aggregate count) goes RED.
//  - pt8 data round-trip (amend D): up -> down -> up preserves the membership
//    links + each entry's universe home. down drops the new objects; a re-apply
//    re-derives the SAME links from entries.universe_id (no link lost, no entry
//    re-homed). Proven here on the throwaway subset (shared-DB safe: int tests run
//    --no-file-parallelism and W-1 is the first worlds consumer).
//  - pt6 (count===rows): N/A for additive W-1 — it adds no *Cascade fn; the
//    invariant lives only in the existing delete*Cascade (mutations.ts) and is
//    re-armed at W-2 (deleteWorldCascade). Named-deferred, not silently absent.
//  - pt7 (dedup re-scope): DEFERRED to W-3 — additive W-1 adds no world-scoped
//    reader, so phrase_mentions/resolved_marks/dismissed_suggestions have nothing
//    to re-scope yet. Named-deferred, not silently dropped.
//
// SHARED-DB HYGIENE: all ids are `test-w1-*`; afterAll hard-deletes the throwaway
// universes + entries + their membership links in FK order. migrate() is
// idempotent and DB-wide, so it also (re)links the live universe-1 entries — that
// is correct and left in place (the real backfill); we assert ONLY on our ids.
// The live universe-1 / its world are never deleted.
// -----------------------------------------------------------------------------

const uAId = `test-w1-uni-${randomUUID()}`;
const uBId = `test-w1-uni-${randomUUID()}`;
const worldA = `world-${uAId}`; // deterministic id the migration derives (B1)
const worldB = `world-${uBId}`;
// Three throwaway entries: two in universe A (one LIVE, one TOMBSTONED) and one
// in universe B. The tombstoned + cross-universe mix is what makes per-row homing
// measurable — a mis-homing mutation mislinks at least one of them.
const entA1Id = `test-w1-ent-${randomUUID()}`; // universe A, live
const entA2Id = `test-w1-ent-${randomUUID()}`; // universe A, tombstoned
const entBId = `test-w1-ent-${randomUUID()}`; // universe B, live

async function seedFixture(): Promise<void> {
  await query(`INSERT INTO universes (id, name) VALUES ($1, $2), ($3, $4)`, [
    uAId, "W1 Universe A", uBId, "W1 Universe B",
  ]);
  // kind='character' is a built-in category id (soft FK); shelf mirrors it.
  await query(
    `INSERT INTO entries (id, kind, name, catalogue_no, shelf, universe_id, deleted_at)
       VALUES ($1,'character','A1','w1-c1','people',$4,NULL),
              ($2,'character','A2','w1-c2','people',$4,123),
              ($3,'character','B1','w1-c3','people',$5,NULL)`,
    [entA1Id, entA2Id, entBId, uAId, uBId],
  );
}

async function clearFixtureLinksAndWorlds(): Promise<void> {
  // Scoped teardown of ONLY this fixture's worlds/links (FK: links, then worlds).
  await query(`DELETE FROM world_entities WHERE entity_id = ANY($1)`, [[entA1Id, entA2Id, entBId]]);
  await query(`DELETE FROM worlds WHERE id = ANY($1)`, [[worldA, worldB]]);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  await seedFixture();
});

afterAll(async () => {
  // FK order: membership links -> entries -> worlds -> universes. Sweep by the
  // `test-w1-%` PREFIX (not just this run's random UUIDs): if a prior run crashed
  // mid-test (e.g. a mutation-proof RED), its orphaned rows carry fresh UUIDs this
  // run's id-list can't match — a prefix sweep is what keeps the SHARED baseline
  // self-healing. The live universe-1 / its world never match this prefix.
  await query(`DELETE FROM world_entities WHERE entity_id LIKE 'test-w1-%'`);
  await query(`DELETE FROM entries WHERE id LIKE 'test-w1-%'`);
  await query(`DELETE FROM worlds WHERE id LIKE 'world-test-w1-%'`);
  await query(`DELETE FROM universes WHERE id LIKE 'test-w1-%'`);
  await closePool();
});

/** The world a given entry's membership row points at (or null if unlinked). */
async function worldOf(entityId: string): Promise<string | null> {
  const row = await one<{ world_id: string }>(
    `SELECT world_id FROM world_entities WHERE entity_id = $1`,
    [entityId],
  );
  return row?.world_id ?? null;
}

describe("W-1 worlds-membership expand migration (real Postgres)", () => {
  it("pt5 PER-ROW backfill: each entry (incl. tombstoned) links EXACTLY its own universe's world", async () => {
    await migrate();

    // The load-bearing per-ENTRY assertions (NOT an aggregate count). A backfill
    // JOIN that links to the wrong universe's world flips at least one of these,
    // even though count(world_entities)==count(entries) would still pass.
    expect(await worldOf(entA1Id)).toBe(worldA); // universe A, live
    expect(await worldOf(entA2Id)).toBe(worldA); // universe A, TOMBSTONED (still linked)
    expect(await worldOf(entBId)).toBe(worldB);  // universe B, live

    // And the worlds themselves were derived 1:1 from the universes (B1).
    const wA = await one<{ universe_id: string; title: string }>(
      `SELECT universe_id, title FROM worlds WHERE id = $1`, [worldA],
    );
    expect(wA?.universe_id).toBe(uAId);
    expect(wA?.title).toBe("W1 Universe A");
  });

  it("pt5 (built-ins stay global): the migration leaves built-in categories world_id = NULL", async () => {
    await migrate(); // idempotent
    const builtins = await rows<{ world_id: string | null }>(
      `SELECT world_id FROM categories WHERE is_builtin = true`,
    );
    expect(builtins.length).toBeGreaterThanOrEqual(4);
    // Every built-in is GLOBAL (NULL) so a shared entity's kind always resolves.
    expect(builtins.every((c) => c.world_id === null)).toBe(true);
  });

  it("pt8 ROUND-TRIP: up -> (scoped) down -> up re-derives the SAME links, no entry re-homed", async () => {
    await migrate();
    const before = {
      a1: await worldOf(entA1Id), a2: await worldOf(entA2Id), b: await worldOf(entBId),
    };
    expect(before).toEqual({ a1: worldA, a2: worldA, b: worldB });

    // DOWN: drop this fixture's links + worlds (the down-migration's effect,
    // scoped to the throwaway subset for shared-DB safety). Entries + their
    // universe_id home are untouched — that is what makes re-derivation possible.
    await clearFixtureLinksAndWorlds();
    expect(await worldOf(entA1Id)).toBeNull();
    // Entries' homes survive the down (nothing re-homed).
    const homeA2 = await one<{ universe_id: string; deleted_at: string | null }>(
      `SELECT universe_id, deleted_at FROM entries WHERE id = $1`, [entA2Id],
    );
    expect(homeA2?.universe_id).toBe(uAId);
    expect(homeA2?.deleted_at).not.toBeNull(); // still tombstoned

    // UP again: re-derives identical links from entries.universe_id.
    await migrate();
    expect(await worldOf(entA1Id)).toBe(worldA);
    expect(await worldOf(entA2Id)).toBe(worldA);
    expect(await worldOf(entBId)).toBe(worldB);
  });

  it("down() is a clean, idempotent global revert (drops the new objects)", async () => {
    // Prove the real down() runs and drops the objects globally, then restore via
    // migrate() so the suite (and any later serial int file) sees the expanded
    // shape. Scoped-safe: --no-file-parallelism, W-1 is the first worlds consumer.
    //
    // W-1's down owns ONLY worlds/world_entities/categories.world_id and drops them
    // WITHOUT CASCADE. The later W-6 layer hung books.world_id -> worlds(id) off the
    // worlds table, so a global W-1 down can only run once W-6 is reversed first.
    // Reverse the whole stack it depends on (w6b -> w6a), then W-1 down cleanly.
    await migrate();
    await w6bDown(); // rebuild bridge series, restore books.series_id NOT NULL
    await w6aDown(); // drop books.world_id (+ its FK to worlds) so worlds has no dependents
    await down();
    expect(await one(`SELECT to_regclass('public.worlds') AS r`)).toEqual({ r: null });
    expect(await one(`SELECT to_regclass('public.world_entities') AS r`)).toEqual({ r: null });
    const hasCol = await rows(
      `SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='world_id'`,
    );
    expect(hasCol.length).toBe(0);

    // Restore the FULL expanded shape (W-1 -> w6a -> w6b) so the shared DB is back
    // at the W-6 target — books.world_id NOT NULL + its FK, series gone — for any
    // later serial int file (w6BooksWorld asserts the FK exists). Re-link this
    // fixture too for a clean afterAll.
    await migrate();
    expect(await worldOf(entBId)).toBe(worldB);
    await w6aUp();
    await w6bUp();
    // The W-6 FK must be back (w6a re-creates it on a genuinely fresh column).
    const fk = await rows(
      `SELECT 1 FROM pg_constraint WHERE conname = 'books_world_id_fkey'`,
    );
    expect(fk.length).toBe(1);
  });
});
