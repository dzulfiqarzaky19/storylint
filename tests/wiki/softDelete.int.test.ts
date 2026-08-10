import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { insertEntry, softDeleteEntry } from "@/lib/db/mutations";
import { getAllEntries, getEntry } from "@/lib/db/queries";
import { confirmWikiWrite } from "@/lib/actions/confirmation";

// -----------------------------------------------------------------------------
// F6-S2 — soft-delete read-filter (INTEGRATION, real Postgres). Proves the
// behavior lock: a soft-deleted entry (deleted_at set) vanishes from every live
// entry read — getAllEntries (feeds shelves + the AI gazetteer) and getEntry.
//
// This is the truest lock for the SQL `WHERE deleted_at IS NULL`: drop that
// clause in queries.ts and the deleted entry REAPPEARS in getAllEntries ->
// these assertions go RED. A pure/mock test could not catch a SQL-string change.
//
// SHARED-DB HYGIENE: every entry uses a throwaway id (`test-f6s2-<uuid>`) and is
// hard-deleted in afterEach, so this spec never touches seeded rows other specs
// rely on. closePool() in afterAll releases the connection.
// -----------------------------------------------------------------------------

loadEnv();

const CONFIRM = confirmWikiWrite({ confirmed: true });
const created: string[] = [];

async function freshEntry(name: string): Promise<string> {
  const id = `test-f6s2-${randomUUID()}`;
  await insertEntry(
    {
      id,
      kind: "character",
      name,
      catalogueNo: "TEST",
      note: "",
      summary: "",
      shelf: "people",
      sortOrder: 999,
    },
    CONFIRM,
  );
  created.push(id);
  return id;
}

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterEach(async () => {
  // Hard-clean (real DELETE, not soft) every entry this run created.
  while (created.length > 0) {
    const id = created.pop()!;
    await query(`DELETE FROM entries WHERE id = $1`, [id]);
  }
});

afterAll(async () => {
  await closePool();
});

describe("soft-delete read-filter (F6-S2, real Postgres)", () => {
  it("getAllEntries EXCLUDES a soft-deleted entry but keeps a live one", async () => {
    const liveId = await freshEntry("Live One");
    const deletedId = await freshEntry("Dead One");
    await softDeleteEntry({ id: deletedId, deletedAt: Date.now() }, CONFIRM);

    const all = await getAllEntries();
    const ids = new Set(all.map((e) => e.id));
    expect(ids.has(liveId)).toBe(true); // positive: live entry present
    expect(ids.has(deletedId)).toBe(false); // lock: deleted entry gone
  });

  it("getEntry returns null for a soft-deleted id, the row for a live id", async () => {
    const liveId = await freshEntry("Live Two");
    const deletedId = await freshEntry("Dead Two");
    await softDeleteEntry({ id: deletedId, deletedAt: Date.now() }, CONFIRM);

    expect(await getEntry(liveId)).not.toBeNull();
    expect(await getEntry(deletedId)).toBeNull();
  });

  it("softDeleteEntry is idempotent and preserves the first timestamp", async () => {
    const id = await freshEntry("Twice Deleted");
    await softDeleteEntry({ id, deletedAt: 1000 }, CONFIRM);
    await softDeleteEntry({ id, deletedAt: 2000 }, CONFIRM); // no-op: guarded

    const row = await query<{ deleted_at: string | null }>(
      `SELECT deleted_at FROM entries WHERE id = $1`,
      [id],
    );
    // bigint comes back as a string from pg; the FIRST stamp survives.
    expect(row.rows[0]!.deleted_at).toBe("1000");
  });
});
