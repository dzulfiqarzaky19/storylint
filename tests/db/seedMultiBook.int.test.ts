import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { loadEnv } from "@/lib/db/env";
import { seedWithin } from "@/lib/db/seed";

loadEnv();

// -----------------------------------------------------------------------------
// Multi-book seed integration test (Ashkeld II / Vosk Reach / Halen City).
//
// Locks the LOAD-BEARING linkage the ticket calls out: the seed builds a
// universe -> world -> book hierarchy where an entry links to ITS world
// EXPLICITLY, not to 'world-'||universe_id. Vosk entries share universe-1 with
// Ashkeld but must live in world-vosk, never Ashkeld — the exact mis-homing the
// B2 backfill would cause without its NOT-EXISTS guard.
//
// SCRATCH-DB ISOLATION: seedWithin() TRUNCATEs the ENTIRE dataset, so it runs on
// a THROWAWAY database, never the shared live one (same pattern as
// seedWorldLayer.int.test.ts).
//
// GATE (mutation-proof at ready, run manually on a scratch db):
//  - B2 NOT-EXISTS guard: remove the guard -> vosk-*/halen-* also get the
//    'world-'||universe_id row -> vosk-* leaks into world-universe-1 -> the
//    "no leak into Ashkeld" assertion goes RED.
//  - Explicit world_entities insert worldId: swap g.worldId for a wrong world ->
//    per-world distinct counts go RED.
// -----------------------------------------------------------------------------

const scratchDb = `ashkeld_multibook_${randomUUID().replace(/-/g, "")}`;
let adminPool: Pool;
let scratchPool: Pool;

function urlForDb(dbName: string): string {
  const base = process.env.DATABASE_URL!;
  return base.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  adminPool = new Pool({ connectionString: urlForDb("postgres") });
  await adminPool.query(`CREATE DATABASE ${scratchDb}`);
  scratchPool = new Pool({ connectionString: urlForDb(scratchDb) });
  const schema = readFileSync(resolve(process.cwd(), "src/lib/db/schema.sql"), "utf8");
  await scratchPool.query(schema);

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
}, 60_000);

afterAll(async () => {
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

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const r = await scratchPool.query<{ n: string }>(sql, params);
  return Number(r.rows[0]!.n);
}

describe("multi-book seed (real Postgres, scratch db)", () => {
  it("builds the expected universe/world/book hierarchy counts", async () => {
    expect(await count(`SELECT count(*)::text AS n FROM universes`)).toBe(2);
    expect(await count(`SELECT count(*)::text AS n FROM worlds`)).toBe(3);
    expect(await count(`SELECT count(*)::text AS n FROM books`)).toBe(6);
    expect(await count(`SELECT count(*)::text AS n FROM chapters`)).toBe(42);
  });

  it("stamps universe_id per bundle (Vosk shares universe-1; Halen is universe-2)", async () => {
    const u = async (id: string) =>
      count(`SELECT count(*)::text AS n FROM entries WHERE id = $1 AND universe_id = $2`, [id, id.startsWith("halen-") ? "universe-2" : "universe-1"]);
    expect(await u("ash2-corin")).toBe(1);
    expect(await u("vosk-sable")).toBe(1);
    expect(await u("halen-reyes")).toBe(1);
    // Halen entries all sit in universe-2; the rest in universe-1.
    expect(await count(`SELECT count(*)::text AS n FROM entries WHERE id LIKE 'halen-%' AND universe_id <> 'universe-2'`)).toBe(0);
    expect(await count(`SELECT count(*)::text AS n FROM entries WHERE id LIKE 'vosk-%' AND universe_id <> 'universe-1'`)).toBe(0);
    expect(await count(`SELECT count(*)::text AS n FROM entries WHERE id LIKE 'ash2-%' AND universe_id <> 'universe-1'`)).toBe(0);
  });

  it("links each entry to ITS world explicitly — no Vosk/Halen leak into Ashkeld", async () => {
    // THE load-bearing assertion: no vosk-*/halen-* entity appears in Ashkeld.
    expect(
      await count(
        `SELECT count(*)::text AS n FROM world_entities
          WHERE world_id = 'world-universe-1'
            AND (entity_id LIKE 'vosk-%' OR entity_id LIKE 'halen-%')`,
      ),
    ).toBe(0);
    // Each new-world entry sits in EXACTLY its own world.
    const soleWorld = async (id: string) => {
      const r = await scratchPool.query<{ world_id: string }>(
        `SELECT world_id FROM world_entities WHERE entity_id = $1`,
        [id],
      );
      return r.rows.map((x) => x.world_id);
    };
    expect(await soleWorld("vosk-sable")).toEqual(["world-vosk"]);
    expect(await soleWorld("halen-reyes")).toEqual(["world-halen"]);
    expect(await soleWorld("ash2-corin")).toEqual(["world-universe-1"]);
  });

  it("distributes entities per world with no double-counting", async () => {
    const per = await scratchPool.query<{ world_id: string; n: string }>(
      `SELECT world_id, count(*)::text AS n FROM world_entities GROUP BY world_id`,
    );
    const map = new Map(per.rows.map((r) => [r.world_id, Number(r.n)]));
    // Ashkeld = 15 Book I entries + 5 Ash II entries.
    expect(map.get("world-universe-1")).toBe(20);
    expect(map.get("world-vosk")).toBe(12);
    expect(map.get("world-halen")).toBe(16);
    // Every entry has exactly one world (no orphan, no duplicate membership).
    const links = await count(`SELECT count(*)::text AS n FROM world_entities`);
    const entries = await count(`SELECT count(*)::text AS n FROM entries`);
    expect(links).toBe(entries);
  });

  it("gives every book exactly 7 chapters, each restarting at 1", async () => {
    const per = await scratchPool.query<{ book_id: string; n: string; mn: string; mx: string }>(
      `SELECT book_id, count(*)::text AS n, min(number)::text AS mn, max(number)::text AS mx
         FROM chapters GROUP BY book_id`,
    );
    expect(per.rowCount).toBe(6);
    for (const r of per.rows) {
      expect(Number(r.n)).toBe(7);
      expect(Number(r.mn)).toBe(1);
      expect(Number(r.mx)).toBe(7);
    }
  });

  it("keeps Book I chapters intact (byte-identical bodies untouched)", async () => {
    // Book I ch1 title is a stable anchor for "additive, not disturbed".
    const r = await scratchPool.query<{ title: string }>(
      `SELECT title FROM chapters WHERE book_id = 'book-1' AND number = 1`,
    );
    expect(r.rows[0]!.title).toBe("Three Days After");
  });
});
