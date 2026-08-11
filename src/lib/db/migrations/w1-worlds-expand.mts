// W-1 (world-model epic) migration: WORLDS-MEMBERSHIP EXPAND phase.
//
// ADDITIVE ONLY — this file adds the new world-model objects alongside the
// existing series/books hierarchy and touches ZERO existing rows' identity. It
// deliberately does NOT rename series->worlds, does NOT add books.world_id, and
// does NOT enforce any new constraint on an existing table. That keeps the build
// + all 5 worlds*.int suites green (they still drive the live series model) while
// giving W-2/W-3/W-4/W-5 the membership shape to consume. The rename
// (series->worlds, books.series_id->world_id, DEFAULT_SERIES_ID cleanup) is a
// FINAL "W-6 contract" slice AFTER consumers cut over.
//
// Apply:   npx tsx src/lib/db/migrations/w1-worlds-expand.mts
// Revert:  npx tsx src/lib/db/migrations/w1-worlds-expand.mts --down
//
// New objects (see tasks/_scratch-world-model-plan.md §2):
//   worlds         (id PK, universe_id FK CASCADE, title, description, sort_order)
//                  — one world per universe today (1:1); a universe can grow more.
//   world_entities (world_id FK CASCADE, entity_id -> entries FK CASCADE,
//                  PRIMARY KEY(world_id, entity_id)) — M2M membership, ITEM grain.
//                  Entities are SHARED across a universe's worlds via this junction;
//                  the entry's universe_id stays its canonical HOME (unchanged).
//   categories.world_id (nullable FK CASCADE) — visibility/ownership. NULL = GLOBAL
//                  (the 4 built-ins stay NULL so a shared entity's `kind` always
//                  resolves in any world). id stays globally-unique. is_builtin +
//                  soft-delete (TCK-008) untouched.
//
// Backfill (1:1, idempotent, no invented data):
//   B1 — one world per existing universe, id = 'world-'||universe_id (deterministic,
//        re-run-safe), title = universe.name.
//   B2 — link EVERY entry (live AND tombstoned) to its OWN universe's world via a
//        per-row JOIN on entries.universe_id. NO aggregate shortcut: each entry's
//        membership row carries world-of(that entry's universe), so a mis-homing
//        mutation is observable per-entry (gate pt5).
//   B3 — user categories -> their world: NO-OP today. categories has no universe/
//        world source scope and the live DB has 0 user categories (only the 4
//        global built-ins, which correctly stay world_id = NULL). New user cats get
//        a world_id at create-time in a later slice (W-5). Inventing a mapping here
//        would fabricate data, so B3 writes nothing by design.
//
// GATE SECTION (mizaru's signed 8-pt bar, narrowed to this additive surface):
//   pt5 per-row backfill — proven: mutate B2's JOIN (link to the WRONG universe's
//        world) and a PER-ENTRY home assertion goes RED (not the aggregate count,
//        which is necessary-not-sufficient — TCK-008 lesson).
//   pt7 dedup re-scope (phrase_mentions/resolved_marks/dismissed_suggestions) —
//        NAMED-DEFERRED to W-3: additive W-1 adds no world-scoped reader, so there
//        is nothing to re-scope yet. Deferred, not silently dropped.
//   pt6 (count===rows) — N/A for additive W-1: no cascade reader is added here;
//        count===rows lives only in the existing delete*Cascade fns (mutations.ts)
//        and is re-armed at the wiki-delete/re-scope ticket (W-2). Named, not absent.
//   pt8 data round-trip — proven: up->down->up preserves world_entities links (incl.
//        tombstoned entries) + each entry's universe home; down leaves
//        series/books/entries/categories byte-identical.
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

// Additive DDL. Split from backfill for legibility; both run in ONE txn below.
// Order matters: worlds before world_entities/categories.world_id (they FK it).
const DDL_UP: ReadonlyArray<string> = [
  // worlds: sibling to series under a universe. STRUCTURAL (not wiki content) ->
  // no confirmWikiWrite token gates it, same as universes/series/books.
  `CREATE TABLE IF NOT EXISTS worlds (
     id           text PRIMARY KEY,
     universe_id  text NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
     title        text NOT NULL,
     description  text NOT NULL DEFAULT '',
     sort_order   integer NOT NULL DEFAULT 0
   );`,
  // world_entities: M2M membership junction (item grain). Composite PK dedupes a
  // (world, entity) pair; both FKs CASCADE so deleting a world or an entry row
  // cleans its membership edges without orphaning the junction.
  `CREATE TABLE IF NOT EXISTS world_entities (
     world_id   text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
     entity_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
     PRIMARY KEY (world_id, entity_id)
   );`,
  // categories.world_id: nullable ownership/visibility. NULL = global (built-ins).
  // ON DELETE CASCADE: a user category dies with its world (categories are
  // world-OWNED; entities are not — orphan=LEAVE is for entities only).
  `ALTER TABLE categories ADD COLUMN IF NOT EXISTS world_id text REFERENCES worlds(id) ON DELETE CASCADE;`,
  // Indexes: worlds-by-universe (tree read); world_entities-by-entity (W-3/W-4
  // reverse lookup: "which worlds is this entity in").
  `CREATE INDEX IF NOT EXISTS idx_worlds_universe        ON worlds (universe_id);`,
  `CREATE INDEX IF NOT EXISTS idx_world_entities_entity  ON world_entities (entity_id);`,
];

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    for (const stmt of DDL_UP) {
      await client.query(stmt);
    }

    // B1 — one world per universe, id = 'world-'||universe_id. ON CONFLICT DO
    // NOTHING makes a re-run a no-op. title = the universe's own name.
    await client.query(
      `INSERT INTO worlds (id, universe_id, title, sort_order)
         SELECT 'world-' || u.id, u.id, u.name, 0
           FROM universes u
       ON CONFLICT (id) DO NOTHING`,
    );

    // B2 — link EVERY entry (live + tombstoned) to its OWN universe's world. The
    // per-row JOIN on e.universe_id is the load-bearing predicate (gate pt5): each
    // membership row's world_id is derived from THAT entry's universe, so a
    // mis-homing mutation is observable per-entry, not just in an aggregate count.
    // ON CONFLICT DO NOTHING => idempotent re-run.
    await client.query(
      `INSERT INTO world_entities (world_id, entity_id)
         SELECT 'world-' || e.universe_id, e.id
           FROM entries e
       ON CONFLICT (world_id, entity_id) DO NOTHING`,
    );

    // B3 — user-category -> world backfill is a deliberate NO-OP (see header):
    // built-ins stay world_id NULL (global); zero user cats exist to map.

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Reversible down-migration. Inverse order of DDL_UP: drop the categories column
// first (it FKs worlds), then the junction, then worlds. Additive-only up means a
// clean down restores the pre-migration schema AND leaves series/books/entries/
// categories rows byte-identical (gate pt8). IF EXISTS keeps it idempotent.
export async function down(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE categories DROP COLUMN IF EXISTS world_id;`);
    await client.query(`DROP TABLE IF EXISTS world_entities;`);
    await client.query(`DROP TABLE IF EXISTS worlds;`);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  loadEnv();
  const isDown = process.argv.includes("--down");
  if (isDown) {
    await down();
    console.log("[w1-worlds-expand] reverted: dropped categories.world_id, world_entities, worlds.");
  } else {
    await migrate();
    console.log(
      "[w1-worlds-expand] applied: worlds + world_entities + categories.world_id, " +
        "backfilled 1 world/universe + linked every entry (live+tombstoned) to its universe's world.",
    );
  }
  await closePool();
}

// Run only when invoked directly (npx tsx …/w1-worlds-expand.mts [--down]), never
// on import — so a test/verify harness can import { migrate, down } without the
// module self-executing against whatever DATABASE_URL happens to be set.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[w1-worlds-expand] failed:", err);
    await closePool();
    process.exit(1);
  });
}
