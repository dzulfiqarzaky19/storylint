import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";

// -----------------------------------------------------------------------------
// W-6 — books.world_id SCHEMA CONTRACT (INTEGRATION, real Postgres).
//
// After the 3-step deploy (w6a expand -> code cut-over -> w6b contract) a book
// belongs DIRECTLY to a WORLD. This test locks the DB-level guarantees that the
// w6b contract established, independent of any mutations.ts logic:
//   A. books.world_id is a REAL FK to worlds(id) — inserting a book with a
//      non-existent world_id is rejected (FK violation).
//   B. the FK is ON DELETE CASCADE — deleting a world removes its books at the
//      DB level (no orphan books, no manual cascade needed).
//   C. books.world_id is NOT NULL — a book cannot exist without a world.
//   D. the `series` table is GONE (w6b DROP TABLE series CASCADE).
// These are pure schema assertions: if a future migration weakens the FK,
// drops the cascade, relaxes NOT NULL, or resurrects series, one of A-D goes RED.
//
// SHARED-DB HYGIENE: ids `test-w6bw-*`; afterAll hard-deletes residue in FK
// order (books -> worlds -> universe). The seeded universe-1 is never touched.
// -----------------------------------------------------------------------------

loadEnv();

const uId = `test-w6bw-uni-${randomUUID()}`;
const wId = `test-w6bw-wr-${randomUUID()}`;
const bId = `test-w6bw-bk-${randomUUID()}`;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  await query(`INSERT INTO universes (id, name) VALUES ($1, 'W6BW Universe')`, [uId]);
  await query(
    `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ($1, $2, 'W6BW World', 0)`,
    [wId, uId],
  );
});

afterAll(async () => {
  await query(`DELETE FROM books WHERE id = ANY($1)`, [[bId]]);
  await query(`DELETE FROM books WHERE world_id = $1`, [wId]);
  await query(`DELETE FROM worlds WHERE id = $1`, [wId]);
  await query(`DELETE FROM universes WHERE id = $1`, [uId]);
  await closePool();
});

describe("W-6 books.world_id schema contract (real Postgres)", () => {
  it("A: world_id is a real FK — a book pointing at a non-existent world is rejected", async () => {
    const ghost = `test-w6bw-ghost-${randomUUID()}`;
    await expect(
      query(
        `INSERT INTO books (id, name, world_id, sort_order) VALUES ($1, 'Orphan', $2, 0)`,
        [`test-w6bw-orphan-${randomUUID()}`, ghost],
      ),
    ).rejects.toThrow(); // FK violation: worlds(id) has no such row
  });

  it("C: world_id is NOT NULL — a book with a NULL world is rejected", async () => {
    await expect(
      query(
        `INSERT INTO books (id, name, world_id, sort_order) VALUES ($1, 'NullWorld', NULL, 0)`,
        [`test-w6bw-nullw-${randomUUID()}`],
      ),
    ).rejects.toThrow(); // NOT NULL violation on world_id
  });

  it("B: FK is ON DELETE CASCADE — deleting a world removes its books at the DB level", async () => {
    // Fresh world+book so the cascade is observable in isolation.
    const w2 = `test-w6bw-wr-${randomUUID()}`;
    const b2 = `test-w6bw-bk-${randomUUID()}`;
    await query(
      `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ($1, $2, 'Cascade World', 1)`,
      [w2, uId],
    );
    await query(
      `INSERT INTO books (id, name, world_id, sort_order) VALUES ($1, 'Cascade Book', $2, 0)`,
      [b2, w2],
    );
    // Sanity: the book exists before the world delete.
    const before = await query(`SELECT id FROM books WHERE id = $1`, [b2]);
    expect(before.rowCount).toBe(1);

    // Delete ONLY the world; the FK cascade must take the book with it.
    await query(`DELETE FROM worlds WHERE id = $1`, [w2]);

    const after = await query(`SELECT id FROM books WHERE id = $1`, [b2]);
    expect(after.rowCount).toBe(0); // book cascaded away with its world
    // The universe (the world's parent) is untouched by a world-scoped delete.
    const uni = await query(`SELECT id FROM universes WHERE id = $1`, [uId]);
    expect(uni.rowCount).toBe(1);
  });

  it("A': a valid world_id book inserts and reads back keyed to its world", async () => {
    await query(
      `INSERT INTO books (id, name, world_id, sort_order) VALUES ($1, 'Good Book', $2, 0)`,
      [bId, wId],
    );
    const row = await query<{ world_id: string }>(
      `SELECT world_id FROM books WHERE id = $1`,
      [bId],
    );
    expect(row.rowCount).toBe(1);
    expect(row.rows[0]!.world_id).toBe(wId);
  });

  it("D: the series table is gone (w6b DROP TABLE series CASCADE)", async () => {
    const t = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'series'
       ) AS exists`,
    );
    expect(t.rows[0]!.exists).toBe(false);
    // And books no longer carries the old series_id column.
    const col = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_name = 'books' AND column_name = 'series_id'
       ) AS exists`,
    );
    expect(col.rows[0]!.exists).toBe(false);
  });
});
