// W-6 (world-model epic) migration: SERIES CONTRACT phase (STEP 3 of 3).
//
// DESTRUCTIVE — run ONLY after w6a (STEP 1) applied AND the code cut-over commit
// (STEP 2) landed. By now every writer sets books.world_id (via DEFAULT_WORLD_ID
// or an explicit worldId) and NOTHING writes books.series_id, so it is safe to:
//   1. SET books.world_id NOT NULL         (the new sole book->world parentage)
//   2. drop books.series_id (+ its FK)      (the old parentage, now unwritten)
//   3. DROP TABLE series CASCADE            (kills series + the 2 leaked debris rows)
//   4. CREATE INDEX idx_books_world         (replaces idx_books_series)
// The 2 leaked series (test debris) vanish; their books SURVIVE, already re-homed
// onto world-universe-1 by w6a's backfill.
//
// IF w6b RUNS BEFORE STEP 2, insertBook still writes only series_id and world_id
// is NULL for the new row => SET NOT NULL / the missing series_id default throws.
// That is the whole reason the code cut-over MUST land between w6a and w6b.
//
// Apply:   npx tsx src/lib/db/migrations/w6b-series-contract.mts
// Revert:  npx tsx src/lib/db/migrations/w6b-series-contract.mts --down
//
// REVERSIBILITY (gate pt3 — a stub DOWN = FAIL): down() restores a WORKING series
// model, not a placeholder. It recreates the `series` table, re-adds
// books.series_id, REPOPULATES series deterministically from each book's world's
// universe (bridge id `series-${world_id}`, name = the world's title), repoints
// every book back onto its bridge series, then drops books.world_id. After
// up->down the schema + data round-trip: book->series is restored via
// world.universe_id, so joins that read `series` work again. down does NOT try to
// resurrect the 2 leaked debris series (they were never real parentage; up
// deleted them and their books were re-homed) — it rebuilds exactly the series a
// working model needs: one bridge series per surviving world.
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // Guard: w6a must have run (world_id present) and every book must carry a
    // world_id before we can enforce NOT NULL. A NULL here means STEP 1/2 did not
    // complete; RAISE rather than fail obscurely on the ALTER.
    const nulls = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM books WHERE world_id IS NULL`,
    );
    const nullCount = Number(nulls.rows[0]?.n ?? "0");
    if (nullCount > 0) {
      throw new Error(
        `W-6 contract blocked: ${nullCount} book(s) have world_id NULL — ` +
          `run w6a (STEP 1) + the code cut-over (STEP 2) first`,
      );
    }

    // 1. world_id becomes the sole, mandatory book parent.
    await client.query(`ALTER TABLE books ALTER COLUMN world_id SET NOT NULL`);

    // 2. drop the old series parentage (column + its FK go together with the col).
    await client.query(`DROP INDEX IF EXISTS idx_books_series`);
    await client.query(`ALTER TABLE books DROP COLUMN IF EXISTS series_id`);

    // 3. series is now unreferenced; drop it (CASCADE clears idx_series_universe
    //    and anything else hanging off it). The 2 leaked debris series die here.
    await client.query(`DROP TABLE IF EXISTS series CASCADE`);

    // 4. index the new parent for the tree/window joins that used idx_books_series.
    await client.query(`CREATE INDEX IF NOT EXISTS idx_books_world ON books (world_id)`);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// TRUE-REVERSIBLE down: rebuild a working series model. Inverse of migrate():
// recreate series, re-add books.series_id, repopulate + repoint deterministically,
// then drop books.world_id. Idempotent via IF EXISTS / IF NOT EXISTS / ON CONFLICT.
export async function down(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // Recreate the series table (same shape as schema.sql pre-W-6).
    await client.query(
      `CREATE TABLE IF NOT EXISTS series (
         id           text PRIMARY KEY,
         universe_id  text NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
         name         text NOT NULL,
         sort_order   integer NOT NULL DEFAULT 0
       )`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_series_universe ON series (universe_id)`,
    );

    // Re-add books.series_id (nullable for now; SET NOT NULL after repopulate).
    await client.query(
      `ALTER TABLE books ADD COLUMN IF NOT EXISTS series_id text REFERENCES series(id) ON DELETE CASCADE`,
    );

    // Rebuild ONE bridge series per surviving world: id = 'series-'||world_id,
    // universe_id = the world's universe, name = the world's title. Deterministic
    // and re-run-safe (ON CONFLICT). This is the working series model down
    // guarantees — every book's world maps back to exactly one series.
    await client.query(
      `INSERT INTO series (id, universe_id, name, sort_order)
         SELECT 'series-' || w.id, w.universe_id, w.title, w.sort_order
           FROM worlds w
       ON CONFLICT (id) DO NOTHING`,
    );

    // Repoint every book back onto its bridge series (per-row via world_id).
    await client.query(
      `UPDATE books b
          SET series_id = 'series-' || b.world_id
        WHERE b.world_id IS NOT NULL`,
    );

    // series_id is now populated for every book -> enforce NOT NULL (mirrors the
    // pre-W-6 schema where books.series_id was NOT NULL).
    await client.query(`ALTER TABLE books ALTER COLUMN series_id SET NOT NULL`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_books_series ON books (series_id)`,
    );

    // Drop the W-6 parent + its index, restoring the pre-W-6 books shape.
    await client.query(`DROP INDEX IF EXISTS idx_books_world`);
    await client.query(`ALTER TABLE books DROP COLUMN IF EXISTS world_id`);

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
    console.log(
      "[w6b-series-contract] reverted: rebuilt series (bridge series-${world_id}) + " +
        "books.series_id, dropped books.world_id.",
    );
  } else {
    await migrate();
    console.log(
      "[w6b-series-contract] applied: books.world_id NOT NULL, dropped books.series_id, " +
        "DROP TABLE series, idx_books_world.",
    );
  }
  await closePool();
}

// Run only when invoked directly (npx tsx …/w6b-series-contract.mts [--down]),
// never on import — so tests can import { migrate, down } without self-executing.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[w6b-series-contract] failed:", err);
    await closePool();
    process.exit(1);
  });
}
