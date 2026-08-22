import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { loadEnv } from "@/lib/db/env";
import { seedWithin } from "@/lib/db/seed";
import { loadBook } from "@/lib/novel/loadBook";

// The default book backs the app scope; its derived ids (universe-mother-of-
// learning / world-mother-of-learning / mother-of-learning-1) are what the seed
// writes. Counts are DERIVED from the loaded book so a reseed tracks them.
const MOL = loadBook("mother-of-learning");

loadEnv();

// -----------------------------------------------------------------------------
// Seed integration test (real Postgres, scratch db).
//
// The seed builds ONE real hierarchy from the imported novel source: the Mother
// of Learning universe -> its world (Cyoria) -> its book. Locks the LOAD-BEARING
// linkage: every entry links to ITS world (world-mol) EXPLICITLY via the
// world_entities junction, never orphaned and never homed to a stray world, and
// every chapter belongs to book-mol-1. Expectations are DERIVED from the seed
// source (MOL_ENTRIES / MOL_CHAPTERS), so a reseed can never silently re-break
// the counts.
//
// SCRATCH-DB ISOLATION: seedWithin() TRUNCATEs the ENTIRE dataset, so it runs on
// a THROWAWAY database, never the shared live one (same pattern as
// seedWorldLayer.int.test.ts).
//
// GATE (mutation-proof at ready, run manually on a scratch db):
//  - Explicit world_entities insert worldId: swap world-mol for a wrong world ->
//    the "every link homes to world-mol" assertion goes RED.
//  - Drop the chapter book_id -> the per-book chapter count assertion goes RED.
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

describe("seed builds every novel book, each in its own hierarchy (real Postgres, scratch db)", () => {
  it("builds one universe/world/book per discovered book (default first)", async () => {
    // The seed is data-driven: one universe->world->book per `<slug>.chapters.json`
    // in ../novel. All three counts move together, so they must be equal and >= 1.
    const universes = await count(`SELECT count(*)::text AS n FROM universes`);
    const worlds = await count(`SELECT count(*)::text AS n FROM worlds`);
    const books = await count(`SELECT count(*)::text AS n FROM books`);
    expect(universes).toBeGreaterThanOrEqual(1);
    expect(worlds).toBe(universes);
    expect(books).toBe(universes);
    // The default (MoL) book is seeded and lives under its derived ids.
    expect(await count(`SELECT count(*)::text AS n FROM books WHERE id = $1`, [MOL.bookId])).toBe(1);
    // MoL chapter count is DERIVED from its source, scoped to its book.
    expect(
      await count(`SELECT count(*)::text AS n FROM chapters WHERE book_id = $1`, [MOL.bookId]),
    ).toBe(MOL.chapters.length);
  });

  it("stamps every MoL entry with the MoL universe id", async () => {
    // Entry count for the MoL universe matches its source (entries + plotlines,
    // both homed to the MoL universe).
    const molEntries = await count(
      `SELECT count(*)::text AS n FROM entries WHERE universe_id = $1`,
      [MOL.universeId],
    );
    expect(molEntries).toBe(MOL.entries.length + MOL.plotlines.length);
  });

  it("links each entry to ITS world explicitly — no orphan, no stray world", async () => {
    // THE load-bearing assertion: every MoL membership link homes to the MoL world;
    // none leaks to another world, and no entry anywhere is left unlinked.
    expect(
      await count(
        `SELECT count(*)::text AS n FROM world_entities we
           JOIN entries e ON e.id = we.entity_id
          WHERE e.universe_id = $1 AND we.world_id <> $2`,
        [MOL.universeId, MOL.worldId],
      ),
    ).toBe(0);
    const orphans = await count(
      `SELECT count(*)::text AS n FROM entries e
        WHERE NOT EXISTS (SELECT 1 FROM world_entities we WHERE we.entity_id = e.id)`,
    );
    expect(orphans).toBe(0);
  });

  it("gives each entry exactly one world membership (no double-counting)", async () => {
    const links = await count(`SELECT count(*)::text AS n FROM world_entities`);
    const entries = await count(`SELECT count(*)::text AS n FROM entries`);
    expect(links).toBe(entries);
  });

  it("numbers each book's chapters 1..N with no gaps", async () => {
    // Every seeded book restarts chapter numbers at 1 with no gaps (per-book
    // UNIQUE(book_id, number)). Assert the invariant across ALL books.
    const per = await scratchPool.query<{ book_id: string; n: string; mn: string; mx: string }>(
      `SELECT book_id, count(*)::text AS n, min(number)::text AS mn, max(number)::text AS mx
         FROM chapters GROUP BY book_id`,
    );
    expect(per.rowCount).toBeGreaterThanOrEqual(1);
    for (const row of per.rows) {
      expect(Number(row.mn)).toBe(1);
      expect(Number(row.mx)).toBe(Number(row.n));
    }
    // The MoL book specifically carries its full source chapter set.
    const mol = per.rows.find((r) => r.book_id === MOL.bookId)!;
    expect(mol).toBeDefined();
    expect(Number(mol.n)).toBe(MOL.chapters.length);
  });

  it("seeds the first MoL chapter with the source title", async () => {
    const r = await scratchPool.query<{ title: string }>(
      `SELECT title FROM chapters WHERE book_id = $1 AND number = 1`,
      [MOL.bookId],
    );
    expect(r.rows[0]!.title).toBe(MOL.chapters[0]!.title);
  });
});
