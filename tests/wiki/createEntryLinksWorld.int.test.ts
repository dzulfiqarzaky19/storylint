import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { createEntry, createEntryTied } from "@/lib/actions/wiki";

// -----------------------------------------------------------------------------
// TCK-E06 (wiki mint paths): a NEW entry created from /wiki MUST be LINKED to the
// active world, not just written to `entries`. (INTEGRATION, real Postgres.)
//
// BUG (raccoon F-D-03, cross-verified): createEntry / createEntryTied wrote ONLY
// the `entries` row and inserted NO `world_entities` membership. loadWorldSnapshot
// renders /wiki by JOINing world_entities on the active world, so the entry showed
// optimistically (reducer) then VANISHED on a fresh reload — persisted-but-invisible.
// Live repro: entry 22ff48d9 persisted with world_entities link=0 and disappeared
// on reload.
//
// CONTRACT this test locks:
//   1. createEntry({ ..., worldId }) inserts EXACTLY ONE world_entities row
//      (world_id = worldId, entity_id = the new entry id).
//   2. createEntryTied({ ..., worldId }) does the same for the tied child.
//   3. FAIL CLOSED: a blank/whitespace worldId is REJECTED (ok:false) and writes
//      NEITHER an entries row NOR a world_entities row — never mint an orphan.
//
// SHARED-DB HYGIENE: throwaway ids (`test-e06-<uuid>`), hard-deleted in afterEach
// (world_entities cascades off the entry delete, but we delete it explicitly too).
// Asserts OWN deltas by id, never global counts. closePool in afterAll.
// -----------------------------------------------------------------------------

loadEnv();

// A world that exists in the seeded DB. universe-1's default world id.
const WORLD = "world-universe-1";

const createdEntries: string[] = [];

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterEach(async () => {
  while (createdEntries.length > 0) {
    const id = createdEntries.pop()!;
    await query(`DELETE FROM world_entities WHERE entity_id = $1`, [id]);
    await query(`DELETE FROM entries WHERE id = $1`, [id]);
  }
});

afterAll(async () => {
  await closePool();
});

async function worldLinkCount(worldId: string, entryId: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM world_entities WHERE world_id = $1 AND entity_id = $2`,
    [worldId, entryId],
  );
  return Number(rows.rows[0]!.n);
}

async function entryCount(entryId: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM entries WHERE id = $1`,
    [entryId],
  );
  return Number(rows.rows[0]!.n);
}

describe("TCK-E06 createEntry — links the new entry into the active world (real Postgres)", () => {
  it("inserts exactly ONE world_entities row for the active world", async () => {
    const id = `test-e06-${randomUUID()}`;
    createdEntries.push(id);

    const result = await createEntry({
      id,
      kind: "character",
      shelf: "people",
      name: "E06 Wanderer",
      worldId: WORLD,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`expected createEntry to succeed: ${result.error}`);

    // The load-bearing assertion: BEFORE the fix this is 0 (orphan) -> RED.
    expect(await worldLinkCount(WORLD, id)).toBe(1);
  });

  it("FAILS CLOSED on a blank worldId — writes NO entry and NO world link", async () => {
    const id = `test-e06-${randomUUID()}`;
    createdEntries.push(id);

    const result = await createEntry({
      id,
      kind: "character",
      shelf: "people",
      name: "E06 Orphan Guard",
      worldId: "   ",
    });

    // Reject rather than mint an orphan the user can't see.
    expect(result.ok).toBe(false);
    // And it must not have written a half-state: no entry row, no link row.
    expect(await entryCount(id)).toBe(0);
    expect(await worldLinkCount(WORLD, id)).toBe(0);
  });

  it("FAILS CLOSED on a valid-format but NONEXISTENT worldId - atomic rollback, NO orphan", async () => {
    // Zebra Required finding: createEntry was insertEntry() then a SEPARATE
    // linkEntityToWorldRow(). requireWorldId only rejects blank/missing, so a
    // well-formed worldId that names no world PASSED the guard, the entry
    // COMMITTED, then the link threw on the world_entities.world_id FK - leaving
    // exactly the E06 orphan (entry persisted, invisible on reload). The fix runs
    // both INSERTs in ONE txn (insertEntryLinkedToWorld) so the FK throw rolls the
    // entry back with it. This locks that atomicity.
    const id = `test-e06-${randomUUID()}`;
    createdEntries.push(id);

    const result = await createEntry({
      id,
      kind: "character",
      shelf: "people",
      name: "E06 Atomic Guard",
      worldId: `world-does-not-exist-${randomUUID()}`,
    });

    // The bad worldId FK-throws inside the txn -> the whole txn rolls back.
    expect(result.ok).toBe(false);
    // Load-bearing: BEFORE the atomic fix the entry COMMITS before the link
    // throws -> entryCount === 1 (orphan) -> this assertion goes RED.
    expect(await entryCount(id)).toBe(0);
    expect(await worldLinkCount(WORLD, id)).toBe(0);
  });
});

describe("TCK-E06 createEntryTied — links the tied child into the active world (real Postgres)", () => {
  it("inserts exactly ONE world_entities row for the tied child", async () => {
    // Anchor the tie on a seeded entry that exists in universe-1.
    const anchor = await query<{ id: string }>(
      `SELECT e.id FROM entries e
       JOIN world_entities we ON we.entity_id = e.id AND we.world_id = $1
       WHERE e.deleted_at IS NULL
       LIMIT 1`,
      [WORLD],
    );
    const toEntryId = anchor.rows[0]?.id;
    if (!toEntryId) throw new Error("no seeded world-linked entry to anchor the tie on");

    const result = await createEntryTied({
      name: "E06 Tied Child",
      kind: "character",
      shelf: "people",
      toEntryId,
      rel: "child of",
      worldId: WORLD,
      confirmed: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`expected createEntryTied to succeed: ${result.error}`);
    createdEntries.push(result.data.entryId);

    // BEFORE the fix: the tied child has 0 world links -> RED.
    expect(await worldLinkCount(WORLD, result.data.entryId)).toBe(1);
  });
});
