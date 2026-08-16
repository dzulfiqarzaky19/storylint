// T-AICACHE migration: CHAPTER-CHECK-CACHE EXPAND phase (additive).
//
// ADDITIVE ONLY — this file CREATES the new `chapter_check_cache` table and
// nothing else. It touches NO existing table, drops NOTHING, and enforces NO new
// constraint on any existing row, so every existing suite stays green and the
// live DB's data is byte-identical after it runs.
//
// WHY: the per-chapter AI cross-check (Manuscript.runAiCheck) lives only in React
// refs (aiMarksRef/aiHashesRef). Navigating away unmounts the component and the
// result vanishes, so returning to a chapter re-fires the (expensive, network)
// AI call. This table persists the LAST AI result per chapter so the Write rail
// rehydrates instantly on open, and the AI only re-runs when the chapter body OR
// the wiki snapshot it was checked against actually changed (body_hash/wiki_hash).
//
// Deterministic marks are NOT cached here — they are cheap and re-derived every
// load (checkManuscript). Only the genuinely expensive AI result is stored.
//
// One row per chapter (PK = chapter_id, FK chapters(id) ON DELETE CASCADE) so a
// deleted chapter takes its cache with it. Idempotent: CREATE TABLE IF NOT EXISTS.
//
// Apply:   npx tsx src/lib/db/migrations/aicache-chapter-check-expand.mts
// Revert:  npx tsx src/lib/db/migrations/aicache-chapter-check-expand.mts --down
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // The cache row. body_hash/wiki_hash are the invalidation signal: the row is
    // FRESH only while BOTH still match the chapter's current body and the wiki
    // snapshot the AI last saw. marks is the AI Mark[] (jsonb) to rehydrate the
    // rail. checked_at is epoch millis of the last successful AI pass.
    await client.query(
      `CREATE TABLE IF NOT EXISTS chapter_check_cache (
         chapter_id  text PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
         body_hash   text NOT NULL,
         wiki_hash   text NOT NULL,
         marks       jsonb NOT NULL,
         checked_at  bigint NOT NULL
       )`,
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Reversible down-migration. Additive-only up means dropping the table restores
// the pre-migration schema exactly (the table held only runtime cache, never
// canon), so no data is lost that wasn't a re-derivable AI result. IF EXISTS
// keeps it idempotent.
export async function down(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`DROP TABLE IF EXISTS chapter_check_cache`);
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
    console.log("[aicache-chapter-check-expand] reverted: dropped chapter_check_cache.");
  } else {
    await migrate();
    console.log(
      "[aicache-chapter-check-expand] applied: created chapter_check_cache " +
        "(chapter_id PK, body_hash, wiki_hash, marks jsonb, checked_at).",
    );
  }
  await closePool();
}

// Run only when invoked directly, never on import — so a test/verify harness can
// import { migrate, down } without the module self-executing against whatever
// DATABASE_URL happens to be set.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[aicache-chapter-check-expand] failed:", err);
    await closePool();
    process.exit(1);
  });
}
