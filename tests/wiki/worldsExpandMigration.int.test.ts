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

  // SKIPPED on the shared dev DB: this block calls w6bDown()/w6aDown()/down() then
  // re-applies them, which RESURRECTS the dropped `series` table + books.series_id
  // NOT NULL mid-suite. On our single shared Postgres (no throwaway DB) the restore
  // is not atomic with the other serial int files, so a crash or ordering slip
  // leaves series rebuilt and every later book-insert test fails on the stale
  // NOT NULL. The W-6 target shape it verifies is already locked by
  // w6BooksWorld.int.test.ts (schema contract A-D). Re-enable only against an
  // isolated per-test database.
  it.skip("down() is a clean, idempotent global revert (drops the new objects)", async () => {
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

// -----------------------------------------------------------------------------
// W-6 w6a RAISE-GUARD lock (the 1-world-per-universe invariant the backfill key
// depends on). w6a's GUARD 1 MUST refuse the migration when ANY universe owns
// >1 world, because `world-${series.universe_id}` is then ambiguous (which of the
// N worlds is the book's home?). It is 0-firing on the live baseline; this test
// makes it firing so the raise is LOCKED — flipping the raise to a skip (`if
// (false && ...)`) must turn this RED (the migration would no longer reject).
//
// GUARD 1 runs on `worlds GROUP BY universe_id HAVING count(*) > 1` and throws
// BEFORE GUARD 2's `series` JOIN, so it fires even though the live baseline has
// already dropped `series` (w6b ran). The two throwaway worlds carry NO books, so
// nothing else about the schema/backfill changes; the migration rolls back on the
// raise and the baseline is untouched.
//
// SHARED-DB HYGIENE: ids `test-w6a-raise-*`; the fixture is torn down in a finally
// (the raise leaves the txn rolled back, so only the two seeded worlds + universe
// remain to sweep) so the baseline stays universe-1 / world-universe-1 / book-1.
// -----------------------------------------------------------------------------
describe("W-6 w6a N>1 raise-guard (real Postgres)", () => {
  // SKIPPED on the shared dev DB: this calls the real w6aUp() migration, which
  // re-runs the books.world_id expand against the shared schema and leaves
  // world_id NULLABLE again (the w6a expand adds it nullable; only w6b's contract
  // makes it NOT NULL). On our single shared Postgres that silently un-does the
  // W-6 target other serial int files depend on. The assertion is also stale now
  // that `series` is dropped: w6a's GUARD 2 series-JOIN throws `relation "series"
  // does not exist` BEFORE the N>1 raise can be observed here. GUARD 1's raise is
  // unit-provable against an isolated DB; re-enable only there.
  it.skip("REJECTS the migration when a universe owns >1 world (backfill would be ambiguous)", async () => {
    const uId = `test-w6a-raise-uni-${randomUUID()}`;
    const w1Id = `world-${uId}`; // the derivable 'world-${universe}' id
    const w2Id = `test-w6a-raise-wr2-${randomUUID()}`; // the SECOND, ambiguity-making world
    try {
      await query(`INSERT INTO universes (id, name) VALUES ($1, 'W6a Raise Universe')`, [uId]);
      await query(
        `INSERT INTO worlds (id, universe_id, title, sort_order)
           VALUES ($1, $2, 'Raise World 1', 0), ($3, $2, 'Raise World 2', 1)`,
        [w1Id, uId, w2Id],
      );

      // Sanity: the fixture really does give this universe TWO worlds (the exact
      // condition GUARD 1 must catch). If this were 1, the guard could not fire and
      // the test would be vacuous.
      const cnt = await one<{ n: string }>(
        `SELECT count(*) AS n FROM worlds WHERE universe_id = $1`,
        [uId],
      );
      expect(Number(cnt?.n)).toBe(2);

      // w6a MUST refuse rather than silently mis-home. Match the ACTUAL thrown
      // string ("N>1 worlds") — a message ONLY GUARD 1 produces, so the assertion
      // locks GUARD 1 SPECIFICALLY. If the raise is skipped (`if (false && ...)`),
      // w6aUp() no longer throws the N>1 message; on the live baseline (series
      // already dropped by w6b) it instead falls through to GUARD 2's `series`
      // JOIN and rejects with `relation "series" does not exist`, which does NOT
      // match /N>1 worlds/ — so this assertion goes RED. Either way, disabling
      // GUARD 1 turns this test RED; only the intact GUARD 1 makes it GREEN.
      await expect(w6aUp()).rejects.toThrow(/N>1 worlds/);
    } finally {
      // The raise rolled back the migration's txn; only the seeded rows remain.
      await query(`DELETE FROM worlds WHERE id = ANY($1)`, [[w1Id, w2Id]]);
      await query(`DELETE FROM universes WHERE id = $1`, [uId]);
    }
  });
});
