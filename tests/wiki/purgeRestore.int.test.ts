import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import {
  insertEntry,
  softDeleteEntry,
  restoreEntry,
  purgeDeletedBefore,
} from "@/lib/db/mutations";
import { getDeletedEntries, getEntry } from "@/lib/db/queries";
import { confirmWikiWrite } from "@/lib/actions/confirmation";

// -----------------------------------------------------------------------------
// F6-S6a — purge + restore backend (INTEGRATION, real Postgres). Proves the DB
// locks that a mock cannot: the SQL WHERE clauses and the bigint round-trip.
//
// Locks proven here:
//  * getDeletedEntries surfaces ONLY soft-deleted rows (opposite of the live
//    read filter) and casts deleted_at bigint -> a real JS number.
//  * restoreEntry clears deleted_at for the ADDRESSED id only, is idempotent on
//    an already-live entry (0 rows), and re-enters the entry into live reads.
//  * purgeDeletedBefore hard-deletes only soft-deleted rows older than the
//    cutoff, NEVER a live row, and respects the < cutoff boundary.
//
// SHARED-DB HYGIENE: every row uses a throwaway id (`test-f6s6-<uuid>`) and is
// hard-deleted in afterEach, so this spec never touches seeded rows other specs
// rely on. Seeds stay 19/16/33/11/7/7. closePool() in afterAll releases the pool.
// -----------------------------------------------------------------------------

loadEnv();

const CONFIRM = confirmWikiWrite({ confirmed: true });
const created: string[] = [];

async function freshEntry(name: string): Promise<string> {
  const id = `test-f6s6-${randomUUID()}`;
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
  // Hard-clean (real DELETE) every entry this run created, whatever its state.
  while (created.length > 0) {
    const id = created.pop()!;
    await query(`DELETE FROM entries WHERE id = $1`, [id]);
  }
});

afterAll(async () => {
  await closePool();
});

describe("getDeletedEntries (F6-S6a, real Postgres)", () => {
  it("surfaces ONLY soft-deleted entries, newest-deletion-first", async () => {
    const liveId = await freshEntry("S6 Live");
    const oldId = await freshEntry("S6 Old Delete");
    const newId = await freshEntry("S6 New Delete");
    await softDeleteEntry({ id: oldId, deletedAt: 1000 }, CONFIRM);
    await softDeleteEntry({ id: newId, deletedAt: 5000 }, CONFIRM);

    const deleted = await getDeletedEntries();
    const ids = deleted.map((e) => e.id);
    expect(ids).toContain(oldId); // lock: soft-deleted rows surface
    expect(ids).toContain(newId);
    expect(ids).not.toContain(liveId); // lock: live rows are excluded

    // ORDER BY deleted_at DESC: newer deletion precedes older among ours.
    expect(ids.indexOf(newId)).toBeLessThan(ids.indexOf(oldId));
  });

  it("returns deletedAt as a real JS number, not a bigint string (CAST lock)", async () => {
    const id = await freshEntry("S6 Typed");
    await softDeleteEntry({ id, deletedAt: 1234 }, CONFIRM);

    const row = (await getDeletedEntries()).find((e) => e.id === id)!;
    expect(row).toBeDefined();
    expect(typeof row.deletedAt).toBe("number"); // lock: drop the ::double cast -> string
    expect(row.deletedAt).toBe(1234);
  });
});

describe("restoreEntry (F6-S6a, real Postgres)", () => {
  it("clears deleted_at for the addressed id and re-enters it into live reads", async () => {
    const id = await freshEntry("S6 Restore Me");
    await softDeleteEntry({ id, deletedAt: 2000 }, CONFIRM);
    expect(await getEntry(id)).toBeNull(); // gone from live read while deleted

    const restored = await restoreEntry({ id }, CONFIRM);
    expect(restored).toBe(1); // lock: one row restored
    expect(await getEntry(id)).not.toBeNull(); // lock: back in the live wiki
  });

  it("restores ONLY the addressed id, leaving other tombstones untouched", async () => {
    const keepDeletedId = await freshEntry("S6 Stays Deleted");
    const restoreId = await freshEntry("S6 Gets Restored");
    await softDeleteEntry({ id: keepDeletedId, deletedAt: 3000 }, CONFIRM);
    await softDeleteEntry({ id: restoreId, deletedAt: 3000 }, CONFIRM);

    await restoreEntry({ id: restoreId }, CONFIRM);

    // Addressed id is live; the other tombstone is STILL deleted.
    expect(await getEntry(restoreId)).not.toBeNull();
    expect(await getEntry(keepDeletedId)).toBeNull(); // lock: WHERE id restricts the write
    const stillDeleted = (await getDeletedEntries()).map((e) => e.id);
    expect(stillDeleted).toContain(keepDeletedId);
    expect(stillDeleted).not.toContain(restoreId);
  });

  it("is a no-op (0 rows) when the entry is already live (idempotent guard)", async () => {
    const id = await freshEntry("S6 Already Live");
    // never soft-deleted -> deleted_at IS NULL -> the guard excludes it.
    const restored = await restoreEntry({ id }, CONFIRM);
    expect(restored).toBe(0); // lock: AND deleted_at IS NOT NULL guard
    expect(await getEntry(id)).not.toBeNull(); // still live, untouched
  });
});

describe("purgeDeletedBefore (F6-S6a, real Postgres)", () => {
  it("hard-deletes soft-deleted rows older than the cutoff", async () => {
    const id = await freshEntry("S6 Purge Old");
    await softDeleteEntry({ id, deletedAt: 1000 }, CONFIRM);

    const purged = await purgeDeletedBefore({ cutoffMs: 2000 }, CONFIRM);
    expect(purged).toBeGreaterThanOrEqual(1);

    // Row is GONE entirely (hard delete), not just from live reads.
    const row = await query(`SELECT id FROM entries WHERE id = $1`, [id]);
    expect(row.rowCount).toBe(0); // lock: DELETE removed it
  });

  it("respects the < cutoff boundary: a row deleted AT the cutoff survives", async () => {
    const id = await freshEntry("S6 Boundary");
    await softDeleteEntry({ id, deletedAt: 5000 }, CONFIRM);

    // cutoff == deletedAt -> `deleted_at < cutoff` is false -> NOT purged.
    const purged = await purgeDeletedBefore({ cutoffMs: 5000 }, CONFIRM);
    const row = await query(`SELECT id FROM entries WHERE id = $1`, [id]);
    expect(row.rowCount).toBe(1); // lock: strict < keeps the exactly-at-cutoff row
    void purged;
  });

  it("NEVER purges a live entry: a BOUNDED cutoff past our tombstone spares live rows", async () => {
    // SELF-ISOLATION: never an unbounded cutoff against the shared DB. A
    // MAX_SAFE_INTEGER cutoff is an unbounded purge (DELETE every soft-deleted
    // row in the whole DB) and would race other specs' seed tombstones. Instead
    // bound the cutoff just past OUR own tombstone A so it can only reach A, and
    // prove a live sibling B is untouched by the deleted_at IS NOT NULL rail.
    const deletedAt = 4321;
    const deletedId = await freshEntry("S6 Bounded Tomb"); // A: soft-deleted
    const liveId = await freshEntry("S6 Never Purged"); // B: live
    await softDeleteEntry({ id: deletedId, deletedAt }, CONFIRM);

    // cutoff = A.deletedAt + 1 -> reaches A (deleted_at < cutoff), and B is live
    // (deleted_at IS NULL) so the rail excludes it regardless of the cutoff.
    await purgeDeletedBefore({ cutoffMs: deletedAt + 1 }, CONFIRM);

    const gone = await query(`SELECT id FROM entries WHERE id = $1`, [deletedId]);
    expect(gone.rowCount).toBe(0); // A (soft-deleted, < cutoff) is hard-purged

    const live = await query(`SELECT id FROM entries WHERE id = $1`, [liveId]);
    expect(live.rowCount).toBe(1); // lock: deleted_at IS NOT NULL rail protects live rows
    expect(await getEntry(liveId)).not.toBeNull();
  });
});
