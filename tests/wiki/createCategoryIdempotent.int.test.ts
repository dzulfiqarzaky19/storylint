import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { createCategory } from "@/lib/actions/wiki";

// -----------------------------------------------------------------------------
// TCK-010 — "+ New category" double-insert regression (INTEGRATION, real Postgres).
//
// BUG (pre-existing since b885832): one click on "+ New category" inserted TWO
// category rows. React 18 may invoke a startTransition body twice, and the
// action-layer createCategory used to mint a FRESH randomUUID() on every call,
// so a double-fire produced two DISTINCT ids -> two rows (the DB's
// INSERT ... ON CONFLICT (id) DO NOTHING could not dedup two different ids).
//
// FIX: the client generates the id ONCE (outside the transition) and passes it
// through the action, which now threads `input.id` down to the DB mutation. Two
// action calls with the SAME id therefore collapse to ONE row.
//
// This spec locks the ACTION layer end-to-end against a real DB: it double-fires
// the action with one client id and asserts the categories COUNT DELTA is
// exactly 1. A regression that re-generates the id server-side makes the second
// call insert a second row -> delta 2 -> RED.
//
// SHARED-DB HYGIENE: every id used here is a throwaway (`test-tck010-<uuid>`) and
// is hard-deleted in afterEach. closePool in afterAll.
// -----------------------------------------------------------------------------

loadEnv();

const createdCategories: string[] = [];

async function categoryCount(): Promise<number> {
  const res = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM categories`);
  return Number(res.rows[0]!.n);
}

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterEach(async () => {
  while (createdCategories.length > 0) {
    const id = createdCategories.pop()!;
    await query(`DELETE FROM categories WHERE id = $1`, [id]);
  }
});

afterAll(async () => {
  await closePool();
});

describe("createCategory action — TCK-010 double-insert idempotency (real Postgres)", () => {
  it("double-fires with ONE client id and inserts exactly ONE row (count delta == 1)", async () => {
    const id = `test-tck010-${randomUUID()}`;
    createdCategories.push(id);

    const before = await categoryCount();

    // Simulate React 18 invoking the transition body twice: two action calls with
    // the SAME client-generated id (this is the whole point of generating it once
    // outside startTransition).
    const [r1, r2] = await Promise.all([
      createCategory({ id, label: "Relics", shelf: "places" }),
      createCategory({ id, label: "Relics", shelf: "places" }),
    ]);

    const after = await categoryCount();

    // Both calls succeed (idempotent, no PK-violation surfaced as an error).
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) throw new Error("expected both action calls to succeed");
    // Both return the SAME row (same id), never a second distinct category.
    expect(r1.data.id).toBe(id);
    expect(r2.data.id).toBe(id);

    // The load-bearing assertion: exactly one new row, not two.
    expect(after - before).toBe(1);

    // And there is precisely one categories row with that id in the DB.
    const rows = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM categories WHERE id = $1`,
      [id],
    );
    expect(Number(rows.rows[0]!.n)).toBe(1);
  });

  it("a sequential retry with the same id also yields one row (returns the existing category)", async () => {
    const id = `test-tck010-${randomUUID()}`;
    createdCategories.push(id);

    const before = await categoryCount();
    const first = await createCategory({ id, label: "Guilds", shelf: "people" });
    const second = await createCategory({ id, label: "Guilds", shelf: "people" });
    const after = await categoryCount();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("expected both calls to succeed");
    expect(second.data.id).toBe(id);
    expect(after - before).toBe(1); // lock: one row across two calls
  });
});
