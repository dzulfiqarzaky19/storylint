import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { loadEnv } from "@/lib/db/env";

loadEnv();

// T-SEED-RESEARCH-INTEGRITY — the v2 novel seeder (seed-world.js) used to INSERT
// universe/world/book and skip the default research thread createWorld/seed.ts
// mint. Live /research then rendered Threads 0. This spec seeds a throwaway
// world with empty sources (0 chapters) and asserts the world is born with
// exactly one New thread bound to THAT world's universe.

const require = createRequire(import.meta.url);
const { seedWorld } = require("../../.claude/skills/novel-extraction/tools/seed-world.js") as {
  seedWorld: (input: { data: unknown }) => Promise<unknown>;
};

const scratchDb = `ashkeld_swthread_${randomUUID().replace(/-/g, "")}`;
let adminPool: Pool;
let scratchPool: Pool;
let savedUrl: string;
const UNI = `universe-swthread-${randomUUID()}`;
const WORLD = `world-swthread-${randomUUID()}`;
const BOOK = `book-swthread-${randomUUID()}`;

function urlForDb(dbName: string): string {
  const base = process.env.DATABASE_URL!;
  return base.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
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
  process.env.DATABASE_URL = urlForDb(scratchDb);
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

describe("seed-world.js default research thread (scratch db)", () => {
  it("mints exactly one New thread on first seed and stays at one on re-seed", async () => {
    const data = {
      universe: { id: UNI, name: "SW Thread Universe" },
      world: { id: WORLD, title: "SW Thread World" },
      books: [{ id: BOOK, name: "SW Thread Book", sources: [] }],
    };
    await seedWorld({ data });
    const first = await scratchPool.query<{ title: string; scope: string; universe_id: string }>(
      `SELECT title, scope, universe_id FROM research_threads WHERE world_id = $1`,
      [WORLD],
    );
    expect(first.rowCount).toBe(1);
    expect(first.rows[0]!.title).toBe("New thread");
    expect(first.rows[0]!.scope).toBe("chat");
    expect(first.rows[0]!.universe_id).toBe(UNI);

    await seedWorld({ data });
    const second = await scratchPool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM research_threads WHERE world_id = $1`,
      [WORLD],
    );
    expect(second.rows[0]!.n).toBe("1");
  }, 60_000);
});
