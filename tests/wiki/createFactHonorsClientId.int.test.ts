import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { createEntry, createFact } from "@/lib/actions/wiki";
import { DEFAULT_WORLD_ID } from "@/lib/db/scope";

// -----------------------------------------------------------------------------
// createFact client-id + derived-sortOrder round-trip (INTEGRATION, real Postgres).
//
// CONTRACT (T-WRITE-WIKI-MODAL slice A): the /write "Add to the wiki" modal has a
// MARK, not a proposition, so it enriches an entry by calling createFact directly
// with a MARK-KEYED id (`mark-fact-<markKey>`). Two properties the wiring leans on:
//
//   1) HONORS the caller id. createFact must persist the row under the passed id
//      (mirrors createEntry). If it minted a random id instead, a re-confirm would
//      never collide, so it could not be idempotent -> duplicate facts stack.
//   2) IDEMPOTENT on that id. insertFact is ON CONFLICT (id) DO UPDATE, so a second
//      createFact with the same id UPDATES in place (one row, new value), never a
//      second row. This is what makes a double-confirm on /write safe.
//   3) DERIVES sortOrder when omitted. The client can't see the entry's current
//      facts, so it passes no sortOrder; the action must append
//      (getMaxSortOrderForFacts + 1), not collide every fact at 0.
//
// MUTATION TARGETS (each reverted after observing RED):
//   - `input.id ?? randomUUID()` -> `randomUUID()`  breaks (1)+(2): returned id
//     != passed id AND the second call inserts a fresh row -> two rows -> RED.
//   - `input.sortOrder ?? (getMaxSortOrderForFacts+1)` -> `input.sortOrder ?? 0`
//     breaks (3): the appended fact lands at 0 alongside the first -> RED.
//
// SHARED-DB HYGIENE: throwaway ids (`test-fact-*` / `test-factentry-*`), the entry
// hard-deleted in afterEach (facts cascade via FK ON DELETE CASCADE). closePool
// in afterAll.
// -----------------------------------------------------------------------------

loadEnv();

const createdEntries: string[] = [];

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterEach(async () => {
  while (createdEntries.length > 0) {
    const id = createdEntries.pop()!;
    // facts cascade on the entry delete (FK ON DELETE CASCADE).
    await query(`DELETE FROM entries WHERE id = $1`, [id]);
  }
});

afterAll(async () => {
  await closePool();
});

async function seedEntry(): Promise<string> {
  const entryId = `test-factentry-${randomUUID()}`;
  createdEntries.push(entryId);
  const res = await createEntry({
    id: entryId,
    kind: "character",
    shelf: "people",
    name: "Fact Host",
    worldId: DEFAULT_WORLD_ID,
  });
  if (!res.ok) throw new Error("seed entry failed");
  return entryId;
}

describe("createFact action — client id + idempotency + derived sortOrder (real Postgres)", () => {
  it("persists under the CLIENT id and returns it", async () => {
    const entryId = await seedEntry();
    const factId = `test-fact-${randomUUID()}`;

    const res = await createFact({ id: factId, entryId, key: "eye colour", value: "grey" });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected createFact to succeed");
    expect(res.data.factId).toBe(factId);

    const rows = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM facts WHERE id = $1`,
      [factId],
    );
    expect(Number(rows.rows[0]!.n)).toBe(1);
  });

  it("is IDEMPOTENT on a repeated id: one row, value updated in place", async () => {
    const entryId = await seedEntry();
    const factId = `test-fact-${randomUUID()}`;

    await createFact({ id: factId, entryId, key: "eye colour", value: "grey" });
    // Same id, different value -> UPDATE, not a second INSERT.
    await createFact({ id: factId, entryId, key: "eye colour", value: "green" });

    const rows = await query<{ value: string }>(
      `SELECT value FROM facts WHERE entry_id = $1`,
      [entryId],
    );
    // ONE fact only (no dup stacked), carrying the SECOND write's value.
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0]!.value).toBe("green");
  });

  it("DERIVES an appended sortOrder when the caller omits it", async () => {
    const entryId = await seedEntry();
    const idA = `test-fact-${randomUUID()}`;
    const idB = `test-fact-${randomUUID()}`;

    // Neither call passes sortOrder -> the action must derive an APPEND position,
    // so the two facts get DISTINCT, increasing orders (not both 0).
    await createFact({ id: idA, entryId, key: "a", value: "1" });
    await createFact({ id: idB, entryId, key: "b", value: "2" });

    const rows = await query<{ sort_order: number }>(
      `SELECT sort_order FROM facts WHERE entry_id = $1 ORDER BY sort_order ASC`,
      [entryId],
    );
    expect(rows.rows.length).toBe(2);
    expect(rows.rows[1]!.sort_order).toBeGreaterThan(rows.rows[0]!.sort_order);
  });
});
