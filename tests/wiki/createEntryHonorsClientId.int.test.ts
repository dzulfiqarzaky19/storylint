import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { createEntry } from "@/lib/actions/wiki";

// -----------------------------------------------------------------------------
// createEntry client-id round-trip (INTEGRATION, real Postgres).
//
// CONTRACT (WikiScreen.tsx:423-424): the optimistic reducer dispatches
// CREATE_ENTRY with a CLIENT-generated id, then calls createEntry({ id, ... })
// with that SAME id. `settle` does NOT reconcile the returned id, so the
// action MUST persist the client id verbatim — otherwise the optimistic row id
// (client) and the persisted DB row id diverge, and every later op on that
// entry (edit / tie / softDeleteEntry, all keyed by the client id) targets a
// row that does not exist. Data-integrity, save-path.
//
// REGRESSION GUARD: ab76870 accidentally changed L358 from
//   `const id = input.id ?? randomUUID();`  to  `const id = randomUUID();`
// (a sibling-line collateral edit while fixing createCategory). The action
// then IGNORED the passed id and minted a random one. No existing test caught
// it: the other int tests insert via raw SQL / insertEntry and bypass the
// action wrapper. This test closes that gap by driving the ACTION and asserting
// the persisted row carries the client id.
//
// If the action re-generates the id server-side, the returned entryId != the
// client id AND no row exists with the client id -> RED on both assertions.
//
// SHARED-DB HYGIENE: throwaway ids (`test-entryid-<uuid>`), hard-deleted in
// afterEach. closePool in afterAll.
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

describe("createEntry action — honors the caller-supplied id (real Postgres)", () => {
  it("persists the row under the CLIENT id, not a fresh server-minted one", async () => {
    const id = `test-entryid-${randomUUID()}`;
    createdEntries.push(id);

    const result = await createEntry({
      id,
      kind: "character",
      shelf: "people",
      name: "Test Wanderer",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected createEntry to succeed");

    // 1) The action returns the SAME id it was handed (no reconciliation needed).
    expect(result.data.entryId).toBe(id);

    // 2) The load-bearing assertion: a row exists in the DB under the CLIENT id.
    //    A regression that mints a random id leaves ZERO rows here -> RED.
    const rows = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM entries WHERE id = $1`,
      [id],
    );
    expect(Number(rows.rows[0]!.n)).toBe(1);
  });
});
