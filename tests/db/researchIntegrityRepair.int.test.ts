import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { Pool } from "pg";
import { loadEnv } from "@/lib/db/env";

loadEnv();

const execFileAsync = promisify(execFile);

// T-SEED-RESEARCH-INTEGRITY — live-DB repair, proven on a throwaway database.
// migrate() talks through DATABASE_URL, so this never points getPool at live
// ashkeld. Scratch db is unique per run. The CLI is the apply path the ticket
// names (`npx tsx …/research-integrity-repair.mts`), so the spec drives that.

const scratchDb = `ashkeld_sri_${randomUUID().replace(/-/g, "")}`;
let adminPool: Pool;
let scratchPool: Pool;
let savedUrl: string;
const UNI = "universe-sri";

function urlForDb(dbName: string): string {
  const base = process.env.DATABASE_URL!;
  return base.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const r = await scratchPool.query<{ n: string }>(sql, params);
  return Number(r.rows[0]!.n);
}

async function runRepair(): Promise<string> {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [
      resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
      "src/lib/db/migrations/research-integrity-repair.mts",
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: urlForDb(scratchDb) },
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  return `${stdout}\n${stderr}`;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  savedUrl = process.env.DATABASE_URL;
  adminPool = new Pool({ connectionString: urlForDb("postgres") });
  await adminPool.query(`CREATE DATABASE ${scratchDb}`);
  scratchPool = new Pool({ connectionString: urlForDb(scratchDb) });
  const schema = readFileSync(resolve(process.cwd(), "src/lib/db/schema.sql"), "utf8");
  await scratchPool.query(schema);

  await scratchPool.query(`INSERT INTO universes (id, name) VALUES ($1, 'SRI')`, [UNI]);

  // Empty ghost: 0 books/threads/memberships/chapters. Repair must DELETE it.
  await scratchPool.query(
    `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ('world-universe-sri-ghost', $1, 'Ghost', 0)`,
    [UNI],
  );
  // Ghost-named but has a book. Repair must KEEP it and backfill a thread.
  await scratchPool.query(
    `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ('world-universe-sri-kept', $1, 'Kept', 1)`,
    [UNI],
  );
  await scratchPool.query(
    `INSERT INTO books (id, world_id, name, sort_order) VALUES ('book-sri-kept', 'world-universe-sri-kept', 'Kept Book', 0)`,
  );
  // Ghost-named but has a membership. Repair must KEEP it and backfill a thread.
  await scratchPool.query(
    `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ('world-universe-sri-linked', $1, 'Linked', 2)`,
    [UNI],
  );
  await scratchPool.query(
    `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order, universe_id)
     VALUES ('entry-sri-1', 'character', 'SRI Person', '01', '', '', 'people', 0, $1)`,
    [UNI],
  );
  await scratchPool.query(
    `INSERT INTO world_entities (world_id, entity_id) VALUES ('world-universe-sri-linked', 'entry-sri-1')`,
  );
  // Real 0-thread world (not ghost-named). Repair must KEEP it and backfill.
  await scratchPool.query(
    `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ('world-sri-plain', $1, 'Plain', 3)`,
    [UNI],
  );
  await scratchPool.query(
    `INSERT INTO books (id, world_id, name, sort_order) VALUES ('book-sri-plain', 'world-sri-plain', 'Plain Book', 0)`,
  );
  // Already has a thread. Repair must not insert a second one.
  await scratchPool.query(
    `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ('world-sri-already', $1, 'Already', 4)`,
    [UNI],
  );
  await scratchPool.query(
    `INSERT INTO research_threads (id, title, subtitle, sort_order, scope, universe_id, world_id)
     VALUES ('thread-sri-already', 'Existing', '', 0, 'chat', $1, 'world-sri-already')`,
    [UNI],
  );
}, 60_000);

afterAll(async () => {
  process.env.DATABASE_URL = savedUrl;
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

describe("research-integrity-repair (scratch db)", () => {
  it("deletes empty ghosts, keeps content worlds, backfills exactly one default thread per 0-thread world", async () => {
    const firstLog = await runRepair();
    expect(firstLog).toContain("world-universe-sri-ghost");
    expect(firstLog).toContain("world-sri-plain");
    expect(firstLog).toContain("world-universe-sri-kept");
    expect(firstLog).toContain("world-universe-sri-linked");
    expect(firstLog).not.toContain("world-sri-already");

    expect(await count(`SELECT count(*)::text AS n FROM worlds WHERE id = 'world-universe-sri-ghost'`)).toBe(0);
    expect(await count(`SELECT count(*)::text AS n FROM worlds WHERE id = 'world-universe-sri-kept'`)).toBe(1);
    expect(await count(`SELECT count(*)::text AS n FROM worlds WHERE id = 'world-universe-sri-linked'`)).toBe(1);
    expect(await count(`SELECT count(*)::text AS n FROM books WHERE id = 'book-sri-kept'`)).toBe(1);

    const threads = await scratchPool.query<{ world_id: string; title: string; universe_id: string; n: string }>(
      `SELECT world_id, MIN(title) AS title, MIN(universe_id) AS universe_id, count(*)::text AS n
         FROM research_threads
        WHERE world_id IN ('world-sri-plain', 'world-universe-sri-kept', 'world-universe-sri-linked', 'world-sri-already')
        GROUP BY world_id
        ORDER BY world_id`,
    );
    const byWorld = Object.fromEntries(threads.rows.map((r) => [r.world_id, r]));
    expect(byWorld["world-sri-already"]!.title).toBe("Existing");
    expect(byWorld["world-sri-already"]!.n).toBe("1");
    for (const id of ["world-sri-plain", "world-universe-sri-kept", "world-universe-sri-linked"]) {
      expect(byWorld[id]!.title).toBe("New thread");
      expect(byWorld[id]!.n).toBe("1");
      expect(byWorld[id]!.universe_id).toBe(UNI);
    }

    const empty = await count(
      `SELECT count(*)::text AS n FROM worlds w
        WHERE NOT EXISTS (SELECT 1 FROM research_threads rt WHERE rt.world_id = w.id)`,
    );
    expect(empty).toBe(0);

    const secondLog = await runRepair();
    expect(secondLog).toMatch(/ghosts deleted: none/);
    expect(secondLog).toMatch(/default threads backfilled on: none/);
    expect(await count(`SELECT count(*)::text AS n FROM research_threads`)).toBe(4);
  }, 60_000);
});
