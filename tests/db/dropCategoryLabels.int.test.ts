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

// T-ARCH-1 — live leftover `category_labels` (F6) survived after F9-B replaced it
// with `categories`. schema.sql already has no leftover; live :5434 still has the
// empty table. This spec stands up a scratch DB from schema.sql, recreates the
// leftover empty table, then drives the drop expand (`npx tsx …/drop-category-labels.mts`).

const scratchDb = `ashkeld_droplabels_${randomUUID().replace(/-/g, "")}`;
let adminPool: Pool;
let scratchPool: Pool;

function urlForDb(dbName: string): string {
  const base = process.env.DATABASE_URL!;
  return base.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
}

async function publicTableCount(): Promise<number> {
  const r = await scratchPool.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  return Number(r.rows[0]!.n);
}

async function leftoverExists(): Promise<boolean> {
  const r = await scratchPool.query<{ reg: string | null }>(
    `SELECT to_regclass('public.category_labels')::text AS reg`,
  );
  return r.rows[0]!.reg != null;
}

async function runDrop(): Promise<string> {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [
      resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
      "src/lib/db/migrations/drop-category-labels.mts",
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
  adminPool = new Pool({ connectionString: urlForDb("postgres") });
  await adminPool.query(`CREATE DATABASE ${scratchDb}`);
  scratchPool = new Pool({ connectionString: urlForDb(scratchDb) });
  const schema = readFileSync(resolve(process.cwd(), "src/lib/db/schema.sql"), "utf8");
  await scratchPool.query(schema);

  // Recreate the F6 leftover the live DB still carries (empty, 0 rows).
  await scratchPool.query(`
    CREATE TABLE category_labels (
      kind  text PRIMARY KEY
            CHECK (kind IN ('character', 'world', 'organization', 'lore')),
      label text NOT NULL
    )
  `);
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

describe("drop-category-labels (scratch db)", () => {
  it("drops leftover category_labels and leaves schema.sql's 22 tables", async () => {
    expect(await leftoverExists()).toBe(true);
    expect(await publicTableCount()).toBe(23);

    const firstLog = await runDrop();
    expect(firstLog).toMatch(/category_labels/);

    expect(await leftoverExists()).toBe(false);
    expect(await publicTableCount()).toBe(22);
    const categories = await scratchPool.query<{ reg: string | null }>(
      `SELECT to_regclass('public.categories')::text AS reg`,
    );
    expect(categories.rows[0]!.reg).not.toBeNull();

    const secondLog = await runDrop();
    expect(secondLog).toMatch(/category_labels/);
    expect(await leftoverExists()).toBe(false);
    expect(await publicTableCount()).toBe(22);
  }, 60_000);
});
