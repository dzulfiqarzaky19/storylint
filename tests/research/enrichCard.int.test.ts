import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { insertEntry, insertFact, softDeleteEntry } from "@/lib/db/mutations";
import { getFactsForEntry } from "@/lib/db/queries";
import { confirmCard } from "@/lib/actions/research";
import { confirmWikiWrite } from "@/lib/actions/confirmation";
import { DEFAULT_UNIVERSE_ID } from "@/lib/db/scope";

// -----------------------------------------------------------------------------
// F6-S3a — enrich-vs-duplicate (INTEGRATION, real Postgres). Two locks:
//
//  1. insertFact is IDEMPOTENT on id (ON CONFLICT DO UPDATE): re-confirming a
//     card with a STABLE fact id yields exactly ONE fact row carrying the LATEST
//     value — not two rows, not the stale first value. Drop the ON CONFLICT
//     clause and the second insert PK-violates (throws) -> RED.
//
//  2. confirmCard({ enrichEntryId }) folds the card into an EXISTING live entry
//     (adds a fact, no new `prop-` entry) and REJECTS a soft-deleted target
//     (getEntry filters deleted_at IS NULL). Remove the reject guard and a card
//     could write an orphan fact onto a tombstone -> the reject assertion RED.
//
// SHARED-DB HYGIENE: throwaway ids (`test-f6s3-<uuid>`); the FK chain
// thread->turn->proposition and every entry/fact is hard-deleted in afterEach.
// -----------------------------------------------------------------------------

loadEnv();

const CONFIRM = confirmWikiWrite({ confirmed: true });
const entries: string[] = [];
const threads: string[] = [];

async function freshEntry(name: string): Promise<string> {
  const id = `test-f6s3-e-${randomUUID()}`;
  await insertEntry(
    { id, kind: "world", name, catalogueNo: "TEST", note: "", summary: "", shelf: "places", sortOrder: 999 },
    CONFIRM,
  );
  entries.push(id);
  return id;
}

/** Build the thread -> turn -> proposition FK chain confirmCard's getProposition needs. */
async function freshProposition(title: string, body: string): Promise<string> {
  const tag = randomUUID();
  const threadId = `test-f6s3-th-${tag}`;
  const turnId = `test-f6s3-tn-${tag}`;
  const propId = `test-f6s3-p-${tag}`;
  await query(`INSERT INTO research_threads (id, title, universe_id) VALUES ($1, $2, $3)`, [threadId, "T", DEFAULT_UNIVERSE_ID]);
  await query(
    `INSERT INTO research_turns (id, thread_id, ordinal, side, who, text) VALUES ($1, $2, 0, 'them', 'AI', '')`,
    [turnId, threadId],
  );
  await query(
    `INSERT INTO propositions (id, turn_id, kind, title, body, as_kind, sort_order)
     VALUES ($1, $2, 'world', $3, $4, 'world', 0)`,
    [propId, turnId, title, body],
  );
  threads.push(threadId); // CASCADE removes turn + proposition
  return propId;
}

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterEach(async () => {
  while (entries.length > 0) await query(`DELETE FROM entries WHERE id = $1`, [entries.pop()!]);
  while (threads.length > 0) await query(`DELETE FROM research_threads WHERE id = $1`, [threads.pop()!]);
});

afterAll(async () => {
  await closePool();
});

describe("insertFact idempotency (F6-S3a, real Postgres)", () => {
  it("re-inserting the same fact id yields ONE row with the UPDATED value", async () => {
    const entryId = await freshEntry("Idem Entry");
    const factId = `test-f6s3-f-${randomUUID()}`;

    await insertFact({ id: factId, entryId, key: "k", value: "first", fresh: true, sortOrder: 1 }, CONFIRM);
    await insertFact({ id: factId, entryId, key: "k", value: "second", fresh: false, sortOrder: 2 }, CONFIRM);

    const facts = await getFactsForEntry(entryId);
    const mine = facts.filter((f) => f.id === factId);
    expect(mine).toHaveLength(1); // lock: NOT two rows
    expect(mine[0]!.value).toBe("second"); // lock: LATEST value, not stale "first"
  });
});

describe("confirmCard enrich branch (F6-S3a, real Postgres)", () => {
  it("enriches an EXISTING live entry with a fact instead of a new entry", async () => {
    const targetId = await freshEntry("The Tower");
    const propId = await freshProposition("The Tower", "A black spire over Ashkeld.");

    const before = await getFactsForEntry(targetId);
    const res = await confirmCard({
      propositionId: propId,
      entry: { name: "The Tower", kind: "world", summary: "A black spire over Ashkeld." },
      enrichEntryId: targetId,
      confirmed: true,
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.entryId).toBe(targetId); // enriched target, not a new prop- entry
    const after = await getFactsForEntry(targetId);
    expect(after.length).toBe(before.length + 1); // exactly one fact added
    expect(after.some((f) => f.value === "A black spire over Ashkeld.")).toBe(true);
  });

  it("REJECTS enriching a soft-deleted target (never writes onto a tombstone)", async () => {
    const targetId = await freshEntry("Doomed Keep");
    await softDeleteEntry({ id: targetId, deletedAt: Date.now() }, CONFIRM);
    const propId = await freshProposition("Doomed Keep", "...");

    const res = await confirmCard({
      propositionId: propId,
      entry: { name: "Doomed Keep", kind: "world", summary: "..." },
      enrichEntryId: targetId,
      confirmed: true,
    });

    expect(res.ok).toBe(false); // lock: reject, do not resurrect a tombstone
  });
});
