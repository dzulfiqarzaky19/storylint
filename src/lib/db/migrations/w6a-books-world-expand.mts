// W-6 (world-model epic) migration: BOOKS->WORLD EXPAND phase (STEP 1 of 3).
//
// ADDITIVE ONLY — this file adds `books.world_id` (nullable FK worlds) alongside
// the still-present `books.series_id`, then per-row backfills it from each book's
// series' universe. It touches NO existing column's identity, drops NOTHING, and
// enforces NO new constraint on `books` yet (world_id stays nullable here). That
// keeps the build + every worlds*.int suite green while the CODE cut-over lands
// (STEP 2), which starts writing world_id. The destructive contract — SET NOT
// NULL, drop series_id, DROP series — is the SEPARATE w6b-series-contract.mts
// (STEP 3), run only AFTER consumers cut over.
//
// DEPLOY ORDER (do NOT run w6a->w6b back-to-back):
//   STEP 1 — this file: books.world_id added + backfilled; series intact; code
//            UNCHANGED (still writes books.series_id). Both columns coexist.
//   STEP 2 — land the code cut-over commit (writes world_id, series code deleted).
//   STEP 3 — w6b up: SET NOT NULL, drop series_id, DROP series.
// w6b before STEP 2 => insertBook throws on NOT NULL series_id with no value.
//
// Apply:   npx tsx src/lib/db/migrations/w6a-books-world-expand.mts
// Revert:  npx tsx src/lib/db/migrations/w6a-books-world-expand.mts --down
//
// BACKFILL KEY (corrected): a book's home world is SERIES-scoped, not universe-scoped.
// Every series id is `series-<worldId>` (e.g. series-world-vosk -> world-vosk), so
// `world_id = regexp_replace(series_id, '^series-', '')` derives each book's OWN world
// EVEN when a universe owns several worlds. The original key `'world-' || universe_id`
// assumed one-world-per-universe, which the shipped worlds feature invalidated
// (universe-1 owns Ashkeld + Vosk + more), so it would collapse every book of a
// multi-world universe into a single world. The guards below enforce the REAL
// invariant per book: the derived world must EXIST and sit in the book's universe;
// otherwise RAISE rather than silently mis-home.
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // ADD the nullable FK column. IF NOT EXISTS => idempotent re-run. ON DELETE
    // CASCADE mirrors books.series_id's cascade so a world delete can own its
    // books' subtree once w6b makes world_id the sole parent.
    await client.query(
      `ALTER TABLE books ADD COLUMN IF NOT EXISTS world_id text REFERENCES worlds(id) ON DELETE CASCADE`,
    );

    // GUARD 1 — every book's derived world (series-<worldId>) must sit in the book's
    // OWN universe. A series id that names a world in a DIFFERENT universe means the
    // `series-<worldId>` convention broke for that row, so RAISE rather than mis-home
    // the book into a foreign universe's world.
    const crossUniverse = await client.query<{ id: string; derived: string }>(
      `SELECT b.id, regexp_replace(b.series_id, '^series-', '') AS derived
         FROM books b
         JOIN series s ON s.id = b.series_id
         JOIN worlds w ON w.id = regexp_replace(b.series_id, '^series-', '')
        WHERE w.universe_id <> s.universe_id
        ORDER BY b.id LIMIT 1`,
    );
    if (crossUniverse.rowCount && crossUniverse.rows[0]) {
      const { id, derived } = crossUniverse.rows[0];
      throw new Error(
        `W-6 backfill: book ${id} derives world ${derived}, which is NOT in the ` +
          `book's universe (series-<worldId> convention violated)`,
      );
    }

    // GUARD 2 — every book's target world must already exist. If a book's derived
    // `series-<worldId>` world row is ABSENT, the backfill would leave that book's
    // world_id NULL (and the assert below would fire), so RAISE up front naming the
    // missing target world AND the orphaned book.
    const missingTarget = await client.query<{ id: string; target: string }>(
      `SELECT b.id, regexp_replace(b.series_id, '^series-', '') AS target
         FROM books b
        WHERE NOT EXISTS (
          SELECT 1 FROM worlds w WHERE w.id = regexp_replace(b.series_id, '^series-', '')
        )
        ORDER BY b.id LIMIT 1`,
    );
    if (missingTarget.rowCount && missingTarget.rows[0]) {
      const { id, target } = missingTarget.rows[0];
      throw new Error(
        `W-6 backfill: missing target world ${target} for book ${id}`,
      );
    }

    // BACKFILL — per-row derivation so each book's world_id comes from THAT book's
    // own series id (`series-<worldId>`). NOT an aggregate assignment: a mis-homing
    // mutation of the key is observable PER-BOOK (gate mutation (a)), not just in a
    // total count. Re-run-safe: re-assigning the same value is a no-op after the
    // guards pass.
    await client.query(
      `UPDATE books
          SET world_id = regexp_replace(series_id, '^series-', '')`,
    );

    // ASSERT — after a clean backfill NO book may carry world_id NULL. If any
    // does, the guards missed a case; RAISE and roll back rather than let w6b's
    // SET NOT NULL fail (or worse, land a mis-homed book).
    const nulls = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM books WHERE world_id IS NULL`,
    );
    const nullCount = Number(nulls.rows[0]?.n ?? "0");
    if (nullCount > 0) {
      throw new Error(
        `W-6 backfill: ${nullCount} book(s) still have world_id NULL after backfill`,
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

// Reversible down-migration. Additive-only up means dropping the column restores
// the pre-migration schema AND leaves books/series rows byte-identical (world_id
// was the ONLY thing added). IF EXISTS keeps it idempotent.
export async function down(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
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
    console.log("[w6a-books-world-expand] reverted: dropped books.world_id.");
  } else {
    await migrate();
    console.log(
      "[w6a-books-world-expand] applied: added books.world_id + per-row backfilled " +
        "from each book's series id (series-<worldId> -> world_id); series intact.",
    );
  }
  await closePool();
}

// Run only when invoked directly (npx tsx …/w6a-books-world-expand.mts [--down]),
// never on import — so a test/verify harness can import { migrate, down } without
// the module self-executing against whatever DATABASE_URL happens to be set.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[w6a-books-world-expand] failed:", err);
    await closePool();
    process.exit(1);
  });
}
