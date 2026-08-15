// T-RESEARCH-2 migration: research_threads -> WORLD EXPAND phase.
//
// ADDITIVE ONLY (mirrors w6a-books-world-expand.mts). This file adds
// `research_threads.world_id` (nullable FK worlds) alongside the still-present
// `universe_id`, then per-row backfills it from each thread's universe's FIRST
// world (by sort_order, id). It touches NO existing column's identity, drops
// NOTHING, and leaves world_id NULLABLE here so the build + every research suite
// stays green while the CODE cut-over lands. The destructive contract — SET NOT
// NULL — is the SEPARATE down-of-nullable step run via `--contract` only AFTER
// consumers (insertResearchThread, listResearchThreads, the grounding path) cut
// over to writing/reading world_id.
//
// schema.sql already declares world_id NOT NULL for FRESH databases (db:reset +
// db:seed). This migration is the LIVE-DB path: an existing drifted DB that has
// research_threads rows without the column. On a fresh reseed there are zero
// threads, so the backfill is a 0-row no-op and --contract's SET NOT NULL is
// trivially satisfied.
//
// DEPLOY ORDER (do NOT run expand -> contract back-to-back on a live DB):
//   STEP 1 — this file (default): world_id added + backfilled; universe_id
//            intact; code UNCHANGED. Both columns coexist.
//   STEP 2 — land the code cut-over (insertResearchThread stamps world_id;
//            listResearchThreads filters by it; grounding reads it).
//   STEP 3 — this file --contract: SET world_id NOT NULL.
//
// Apply:    npx tsx src/lib/db/migrations/research-world-expand.mts
// Contract: npx tsx src/lib/db/migrations/research-world-expand.mts --contract
// Revert:   npx tsx src/lib/db/migrations/research-world-expand.mts --down
//
// BACKFILL KEY: a thread's home world is its universe's FIRST world by
// (sort_order, id). Under the 1-world-per-universe invariant that holds today
// this is unambiguous; a RAISE-GUARD refuses rather than guessing if a thread's
// universe has NO world (would leave world_id NULL and fail the assert). It does
// NOT block on N>1 worlds per universe (the "first" is well-defined by the
// deterministic order), matching how new threads default to the active world.
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // ADD the nullable FK column. IF NOT EXISTS => idempotent re-run. ON DELETE
    // CASCADE mirrors the schema.sql declaration so a world delete owns its
    // threads' subtree.
    await client.query(
      `ALTER TABLE research_threads ADD COLUMN IF NOT EXISTS world_id text REFERENCES worlds(id) ON DELETE CASCADE`,
    );

    // GUARD — every thread's universe must own at least ONE world, else its
    // world_id is NOT derivable and the backfill would leave NULL (failing the
    // assert). RAISE up front naming the orphaned thread + its universe.
    const noWorld = await client.query<{ id: string; universe_id: string }>(
      `SELECT rt.id, rt.universe_id
         FROM research_threads rt
        WHERE NOT EXISTS (
          SELECT 1 FROM worlds w WHERE w.universe_id = rt.universe_id
        )
        ORDER BY rt.id LIMIT 1`,
    );
    if (noWorld.rowCount && noWorld.rows[0]) {
      const { id, universe_id } = noWorld.rows[0];
      throw new Error(
        `T-RESEARCH-2 backfill: thread ${id} is in universe ${universe_id} which has NO world; ` +
          `world_id not derivable`,
      );
    }

    // BACKFILL — per-row: each thread's world_id is the FIRST world of THAT
    // thread's universe, chosen deterministically by (sort_order, id). A
    // correlated subquery, not an aggregate assignment, so a mis-homing mutation
    // of the universe-match predicate (`w.universe_id = rt.universe_id`) is
    // observable PER-THREAD, not just in a total count. Re-run-safe (re-assigns
    // the same value).
    await client.query(
      `UPDATE research_threads rt
          SET world_id = (
            SELECT w.id FROM worlds w
             WHERE w.universe_id = rt.universe_id
             ORDER BY w.sort_order, w.id
             LIMIT 1
          )`,
    );

    // ASSERT — after a clean backfill NO thread may carry world_id NULL. If any
    // does, the guard missed a case; RAISE and roll back rather than let the
    // contract step's SET NOT NULL fail (or land a mis-homed thread).
    const nulls = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM research_threads WHERE world_id IS NULL`,
    );
    const nullCount = Number(nulls.rows[0]?.n ?? "0");
    if (nullCount > 0) {
      throw new Error(
        `T-RESEARCH-2 backfill: ${nullCount} thread(s) still have world_id NULL after backfill`,
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// STEP 3 (contract): SET world_id NOT NULL. Run ONLY after STEP 2's code
// cut-over, once every thread carries a world_id (the expand asserted this).
export async function contract(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `ALTER TABLE research_threads ALTER COLUMN world_id SET NOT NULL`,
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Reversible down-migration. Additive-only up means dropping the column restores
// the pre-migration schema AND leaves research_threads rows byte-identical
// (world_id was the ONLY thing added). Also drops the NOT NULL (dropping the
// column removes the constraint with it). IF EXISTS keeps it idempotent.
export async function down(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `ALTER TABLE research_threads DROP COLUMN IF EXISTS world_id`,
    );
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
  if (process.argv.includes("--down")) {
    await down();
    console.log("[research-world-expand] reverted: dropped research_threads.world_id.");
  } else if (process.argv.includes("--contract")) {
    await contract();
    console.log("[research-world-expand] contracted: research_threads.world_id SET NOT NULL.");
  } else {
    await migrate();
    console.log(
      "[research-world-expand] applied: added research_threads.world_id + per-row " +
        "backfilled from each thread's universe's first world (sort_order, id); universe_id intact.",
    );
  }
  await closePool();
}

// Run only when invoked directly (npx tsx …/research-world-expand.mts [flag]),
// never on import — so a test/verify harness can import { migrate, contract,
// down } without the module self-executing against whatever DATABASE_URL is set.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[research-world-expand] failed:", err);
    await closePool();
    process.exit(1);
  });
}
