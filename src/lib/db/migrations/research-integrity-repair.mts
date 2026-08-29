// T-SEED-RESEARCH-INTEGRITY: live-DB one-off repair for research-thread integrity
// left behind by the novel importer (it bypassed the createWorld default-thread
// seed and left empty duplicate worlds).
//
// TWO idempotent repairs in ONE transaction:
//  (1) DELETE genuinely-empty ghost worlds (0 books AND 0 threads AND 0 world
//      memberships AND 0 chapters). A per-world guard re-verifies emptiness
//      INSIDE the txn and SKIPS (never deletes) any world that has content.
//  (2) BACKFILL exactly ONE default research thread per SURVIVING world that has
//      zero, matching createWorld/seed: title New thread, subtitle empty,
//      sort_order 0, scope chat, world_id = the world, universe_id = THAT WORLD'S
//      own universe_id (never a drifted global constant).
//
// Idempotent: re-running deletes 0 ghosts and backfills 0 threads on a clean DB.
//
// Apply:   npx tsx src/lib/db/migrations/research-integrity-repair.mts
// Dry-run: add --dry-run to print the plan and roll back without mutating.
import { randomUUID } from "node:crypto";
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

// A world is a deletable GHOST only when it has NOTHING: no books, no research
// threads, no entity memberships, no chapters. All four must be zero.
const GHOST_GUARD = `
  SELECT
    (SELECT count(*) FROM books b WHERE b.world_id = w.id) AS books,
    (SELECT count(*) FROM research_threads rt WHERE rt.world_id = w.id) AS threads,
    (SELECT count(*) FROM world_entities we WHERE we.world_id = w.id) AS memberships,
    (SELECT count(*) FROM chapters ch JOIN books b ON ch.book_id = b.id
       WHERE b.world_id = w.id) AS chapters
  FROM worlds w WHERE w.id = $1`;

export async function migrate(
  dryRun = false,
): Promise<{ ghostsDeleted: string[]; threadsBackfilled: string[] }> {
  const client = await getPool().connect();
  const ghostsDeleted: string[] = [];
  const threadsBackfilled: string[] = [];
  try {
    await client.query("BEGIN");

    // Candidates are the empty duplicate worlds the importer left as
    // world-universe-*; the guard below is what authorizes each delete, so a
    // mis-scoped id can never drop a real world.
    const candidates = await client.query<{ id: string }>(
      `SELECT id FROM worlds WHERE id LIKE 'world-universe-%' ORDER BY id`,
    );
    for (const { id } of candidates.rows) {
      const g = await client.query<{
        books: string;
        threads: string;
        memberships: string;
        chapters: string;
      }>(GHOST_GUARD, [id]);
      const row = g.rows[0]!;
      const empty =
        Number(row.books) === 0 &&
        Number(row.threads) === 0 &&
        Number(row.memberships) === 0 &&
        Number(row.chapters) === 0;
      if (!empty) {
        console.log(
          `[research-integrity-repair] SKIP ${id}: not empty ` +
            `(books=${row.books} threads=${row.threads} memberships=${row.memberships} chapters=${row.chapters})`,
        );
        continue;
      }
      if (!dryRun) {
        await client.query(`DELETE FROM worlds WHERE id = $1`, [id]);
      }
      ghostsDeleted.push(id);
    }

    // Every SURVIVING world with zero research threads gets exactly one default
    // thread, universe_id taken from THAT world's own row (the FK-safe source),
    // matching createWorld/seed. randomUUID() mirrors the id the app callers pass.
    const zeroThreadWorlds = await client.query<{ id: string; universe_id: string }>(
      `SELECT w.id, w.universe_id
         FROM worlds w
        WHERE NOT EXISTS (
          SELECT 1 FROM research_threads rt WHERE rt.world_id = w.id
        )
        ORDER BY w.universe_id, w.id`,
    );
    for (const { id, universe_id } of zeroThreadWorlds.rows) {
      if (!dryRun) {
        await client.query(
          `INSERT INTO research_threads (id, title, subtitle, sort_order, scope, universe_id, world_id)
           VALUES ($1, 'New thread', '', 0, 'chat', $2, $3)`,
          [randomUUID(), universe_id, id],
        );
      }
      threadsBackfilled.push(id);
    }

    // After the backfill NO surviving world may have zero threads. If any does,
    // RAISE and roll back rather than leave a world with an empty research rail.
    if (!dryRun) {
      const stillEmpty = await client.query<{ n: string }>(
        `SELECT count(*) AS n FROM worlds w
          WHERE NOT EXISTS (SELECT 1 FROM research_threads rt WHERE rt.world_id = w.id)`,
      );
      const n = Number(stillEmpty.rows[0]?.n ?? "0");
      if (n > 0) {
        throw new Error(
          `research-integrity-repair: ${n} world(s) still have 0 research threads after backfill`,
        );
      }
    }

    if (dryRun) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
    }
    return { ghostsDeleted, threadsBackfilled };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  loadEnv();
  const dryRun = process.argv.includes("--dry-run");
  const { ghostsDeleted, threadsBackfilled } = await migrate(dryRun);
  console.log(
    `[research-integrity-repair]${dryRun ? " (dry-run, rolled back)" : ""} ` +
      `ghosts deleted: ${ghostsDeleted.length ? ghostsDeleted.join(", ") : "none"}; ` +
      `default threads backfilled on: ${threadsBackfilled.length ? threadsBackfilled.join(", ") : "none"}`,
  );
  await closePool();
}

// Run only when invoked directly, never on import — so a test harness can
// import { migrate } without the module self-executing against whatever
// DATABASE_URL happens to be set.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[research-integrity-repair] failed:", err);
    await closePool();
    process.exit(1);
  });
}
