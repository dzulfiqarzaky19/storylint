import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { loadEnv } from "@/lib/db/env";
import { seedWithin } from "@/lib/db/seed";

loadEnv();

// -----------------------------------------------------------------------------
// TCK-011 (W-1 debt) — self-restoring seed: db:seed must backfill the world layer
// (worlds + world_entities) so a `db:reset && db:seed` lands in the post-W-1
// shape, not with 0 worlds (the empty world-scoped /wiki SSR that kept dropping
// between gates). INTEGRATION, real Postgres.
//
// SCRATCH-DB ISOLATION: seedWithin() TRUNCATEs the ENTIRE dataset, so it can NEVER
// run against the shared live `ashkeld` DB (that would wipe live). This test spins
// up a THROWAWAY database (ashkeld_tck011_<uuid>), applies schema.sql to it, runs
// seedWithin on a client from a pool bound to THAT db, asserts, then DROPs the db.
// seedWithin takes an explicit PoolClient (never calls getPool()), so binding it to
// the scratch pool fully isolates it from live.
//
// GATE (mutation-proof at ready, run manually on this scratch db):
//  - B1 world INSERT: mutate it away -> world-scoped read has 0 worlds -> RED.
//  - B2 link JOIN: mutate `e.universe_id` -> a constant/wrong universe -> per-entry
//    membership world_id wrong -> RED (per-row, not an aggregate count).
// Assertions here are the GREEN side: worlds=1 (world-universe-1), world_entities
// count == entries count, every built-in category world_id NULL.
// -----------------------------------------------------------------------------

const scratchDb = `ashkeld_tck011_${randomUUID().replace(/-/g, "")}`;
let adminPool: Pool;   // connects to the default `postgres` db to CREATE/DROP
let scratchPool: Pool; // connects to the throwaway db

/** Rewrite the DATABASE_URL to target a different database name. */
function urlForDb(dbName: string): string {
  const base = process.env.DATABASE_URL!;
  // Replace the path segment (db name) after the host:port/.
  return base.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  // CREATE DATABASE cannot run inside a transaction or via the target db, so use an
  // admin connection to the maintenance `postgres` database.
  adminPool = new Pool({ connectionString: urlForDb("postgres") });
  await adminPool.query(`CREATE DATABASE ${scratchDb}`);

  scratchPool = new Pool({ connectionString: urlForDb(scratchDb) });
  const schema = readFileSync(resolve(process.cwd(), "src/lib/db/schema.sql"), "utf8");
  await scratchPool.query(schema);
}, 60_000);

afterAll(async () => {
  // Drop the throwaway db. Terminate any lingering backends first (a pool conn can
  // otherwise block the DROP), then close pools. The scratch db name is unique per
  // run so nothing else can match it.
  await scratchPool?.end();
  if (adminPool) {
    await adminPool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [scratchDb],
    );
    await adminPool.query(`DROP DATABASE IF EXISTS ${scratchDb}`);
    await adminPool.end();
  }
}, 60_000);

describe("TCK-011 seed backfills the world layer (real Postgres, scratch db)", () => {
  it("db:seed lands in post-W-1 shape: 1 world, every entry linked, built-ins global", async () => {
    // Run the real seed routine in a transaction on the scratch db.
    const client = await scratchPool.connect();
    try {
      await client.query("BEGIN");
      await seedWithin(client);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    // B1: exactly one world, id/title derived from the seeded universe.
    const worlds = await scratchPool.query<{ id: string; universe_id: string; title: string }>(
      `SELECT id, universe_id, title FROM worlds`,
    );
    expect(worlds.rowCount).toBe(1);
    expect(worlds.rows[0]!.id).toBe("world-universe-1");
    expect(worlds.rows[0]!.universe_id).toBe("universe-1");

    // B2: every entry is linked to its universe's world (link count == entry count,
    // and every link points at world-universe-1 since the seed has one universe).
    const entryCount = (await scratchPool.query<{ n: string }>(`SELECT count(*)::text AS n FROM entries`)).rows[0]!.n;
    const linkCount = (await scratchPool.query<{ n: string }>(`SELECT count(*)::text AS n FROM world_entities`)).rows[0]!.n;
    expect(Number(entryCount)).toBeGreaterThan(0); // sanity: the seed has entries
    expect(linkCount).toBe(entryCount);            // per-row parity, not a magic number

    // Per-row: NO entry is left unlinked, and NO link points at a foreign world.
    const orphanEntries = (await scratchPool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM entries e
        WHERE NOT EXISTS (SELECT 1 FROM world_entities we WHERE we.entity_id = e.id)`,
    )).rows[0]!.n;
    expect(orphanEntries).toBe("0");
    const misHomed = (await scratchPool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM world_entities we
         JOIN entries e ON e.id = we.entity_id
        WHERE we.world_id <> 'world-' || e.universe_id`,
    )).rows[0]!.n;
    expect(misHomed).toBe("0");

    // Built-ins stay GLOBAL (world_id NULL) so a shared entity's kind resolves in
    // any world.
    const builtins = await scratchPool.query<{ world_id: string | null }>(
      `SELECT world_id FROM categories WHERE is_builtin = true`,
    );
    expect(builtins.rowCount).toBeGreaterThanOrEqual(4);
    expect(builtins.rows.every((c) => c.world_id === null)).toBe(true);
  }, 60_000);
});
