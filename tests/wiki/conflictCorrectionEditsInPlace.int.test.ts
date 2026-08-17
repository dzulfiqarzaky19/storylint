import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { createEntry, createFact, editFact } from "@/lib/actions/wiki";
import { DEFAULT_WORLD_ID } from "@/lib/db/scope";

// -----------------------------------------------------------------------------
// Conflict correction round-trip (INTEGRATION, real Postgres): resolving a
// CONTRADICTION mark must EDIT the contradicted fact IN PLACE, not append a
// second fact beside it.
//
// CONTRACT (T-WRITE-WIKI-MODAL, user-caught fix): handlePickerConfirm routes a
// conflict-with-factId through editFact (this test) and every other enrich through
// createFact (append). The user-visible failure this guards: after resolving a
// conflict the wiki held BOTH the stale value and the correction, so the next check
// re-flagged the same conflict forever. The proof below asserts the two write
// primitives behave as the router assumes:
//
//   editFact({factId,key,value})  -> COUNT unchanged, value UPDATED (the correction)
//   createFact(...)               -> COUNT +1 (a genuinely new key on the entry)
//
// so wiring "conflict-with-factId -> editFact" cannot silently append.
//
// SHARED-DB HYGIENE: throwaway ids (`test-conflict-*`), the entry hard-deleted in
// afterEach (facts cascade via FK ON DELETE CASCADE). closePool in afterAll.
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
    await query(`DELETE FROM entries WHERE id = $1`, [id]);
  }
});

afterAll(async () => {
  await closePool();
});

async function seedEntry(): Promise<string> {
  const entryId = `test-conflict-entry-${randomUUID()}`;
  createdEntries.push(entryId);
  const res = await createEntry({
    id: entryId,
    kind: "character",
    shelf: "people",
    name: "Conflict Host",
    worldId: DEFAULT_WORLD_ID,
  });
  if (!res.ok) throw new Error("seed entry failed");
  return entryId;
}

async function factCount(entryId: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM facts WHERE entry_id = $1`,
    [entryId],
  );
  return Number(rows.rows[0]!.n);
}

describe("conflict correction — editFact updates in place, createFact appends (real Postgres)", () => {
  it("editFact CORRECTS the contradicted fact: one row, value updated (never a dup)", async () => {
    const entryId = await seedEntry();
    const factId = `test-conflict-fact-${randomUUID()}`;

    // The wiki's original (soon contradicted) value.
    await createFact({ id: factId, entryId, key: "chair-count", value: "four" });
    expect(await factCount(entryId)).toBe(1);

    // Resolving the conflict edits THAT fact in place (the router's 'edit' branch).
    const res = await editFact({ factId, key: "chair-count", value: "seven" });
    expect(res.ok).toBe(true);

    // Still ONE fact (no stale-beside-correction dup), carrying the corrected value.
    expect(await factCount(entryId)).toBe(1);
    const rows = await query<{ value: string }>(
      `SELECT value FROM facts WHERE id = $1`,
      [factId],
    );
    expect(rows.rows[0]!.value).toBe("seven");
  });

  it("createFact APPENDS: a genuinely new key on the entry adds a second row (the factId-unset fallback)", async () => {
    const entryId = await seedEntry();

    await createFact({
      id: `test-conflict-fact-${randomUUID()}`,
      entryId,
      key: "chair-count",
      value: "four",
    });
    // A conflict the server never matched to a row falls back to append: a NEW key.
    await createFact({
      id: `test-conflict-fact-${randomUUID()}`,
      entryId,
      key: "table-count",
      value: "one",
    });

    expect(await factCount(entryId)).toBe(2);
  });
});
