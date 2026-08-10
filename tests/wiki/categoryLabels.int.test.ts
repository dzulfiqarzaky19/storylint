import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import {
  insertEntry,
  insertFact,
  insertTie,
  getCategoryLabels,
  renameCategory,
  resetCategoryLabel,
  deleteCategory,
} from "@/lib/db/mutations";
import { getAllEntries } from "@/lib/db/queries";
import { confirmWikiWrite } from "@/lib/actions/confirmation";
import type { Kind, Shelf } from "@/lib/domain/types";

// TOKEN tsc-enforcement lock (amendment 4): deleteCategory's confirmation arg is
// mandatory, so a call that omits it must fail to type-check. This function is
// never executed — it exists purely so `tsc --noEmit` proves the gate. If the
// token param were dropped from the signature, the @ts-expect-error would become
// an unused-directive ERROR and tsc would fail, flagging the regression.
export function _tokenGateIsTscEnforced(): void {
  // @ts-expect-error deleteCategory requires a WikiWriteConfirmation token.
  void deleteCategory({ kind: "character", deletedAt: 0 });
}

// -----------------------------------------------------------------------------
// F6-S5a — category labels + "delete category" (INTEGRATION, real Postgres).
//
// Behavior locks proven against real SQL (a pure/mock test cannot catch a SQL
// string change):
//  * renameCategory upsert + getCategoryLabels read + blank no-op.
//  * resetCategoryLabel deletes the override row (idempotent).
//  * deleteCategory = bulk soft-delete of ONE kind's LIVE entries: BOTH
//    directions (that kind gone, other kinds untouched), idempotent on the
//    `AND deleted_at IS NULL` guard, and TOMBSTONE SURVIVAL — facts/ties rows
//    are NOT cascade-deleted (only deleted_at set), so S2 badges still render.
//
// SHARED-DB HYGIENE: throwaway ids (`test-f6s5-<uuid>`) hard-deleted in
// afterEach. The category_labels table is 4 FIXED rows shared with the seed, so
// the whole table is SNAPSHOTTED in beforeAll and RESTORED in afterAll — this
// spec must never leave a renamed/removed label behind. The deleteCategory tests
// bulk soft-delete whole KINDS, which also hits real seed entries, so the set of
// live non-throwaway ids is snapshotted in beforeAll and any it soft-deletes are
// resurrected (deleted_at -> NULL) in afterEach. closePool in afterAll.
// -----------------------------------------------------------------------------

loadEnv();

const CONFIRM = confirmWikiWrite({ confirmed: true });
const created: string[] = [];
let labelSnapshot: { kind: string; label: string }[] = [];
// The ids of every entry that is LIVE (deleted_at IS NULL) and NOT a throwaway
// at the start of the run. The deleteCategory tests bulk soft-delete whole kinds
// against the SHARED live DB, which catches these real SEED rows; afterEach must
// resurrect exactly and only these, so live counts do not drift run-to-run. A
// snapshot (rather than a blanket "un-delete everything") guarantees a genuine
// pre-existing S2/S6 tombstone is never wrongly restored.
let liveSeedIds: string[] = [];

async function freshEntry(kind: Kind, shelf: Shelf, name: string): Promise<string> {
  const id = `test-f6s5-${randomUUID()}`;
  await insertEntry(
    { id, kind, name, catalogueNo: "TEST", note: "", summary: "", shelf, sortOrder: 999 },
    CONFIRM,
  );
  created.push(id);
  return id;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  // Snapshot the shared 4-row category_labels table so we can restore it exactly.
  labelSnapshot = (
    await query<{ kind: string; label: string }>(`SELECT kind, label FROM category_labels`)
  ).rows;
  // Snapshot which real (non-throwaway) entries are LIVE now, so afterEach can
  // resurrect exactly those the deleteCategory tests soft-delete.
  liveSeedIds = (
    await query<{ id: string }>(
      `SELECT id FROM entries WHERE deleted_at IS NULL AND id NOT LIKE 'test-f6s5-%'`,
    )
  ).rows.map((r) => r.id);
});

afterEach(async () => {
  while (created.length > 0) {
    const id = created.pop()!;
    // Hard-clean the throwaway entry and any facts/ties that reference it.
    await query(`DELETE FROM ties WHERE from_entry_id = $1 OR to_entry_id = $1`, [id]);
    await query(`DELETE FROM facts WHERE entry_id = $1`, [id]);
    await query(`DELETE FROM entries WHERE id = $1`, [id]);
  }
  // Resurrect any real SEED entry the deleteCategory tests soft-deleted, so the
  // shared DB's live count does not drift. Restricted to the ids that were LIVE
  // at snapshot time — a genuine pre-existing tombstone is never resurrected.
  if (liveSeedIds.length > 0) {
    await query(
      `UPDATE entries SET deleted_at = NULL WHERE deleted_at IS NOT NULL AND id = ANY($1)`,
      [liveSeedIds],
    );
  }
});

afterAll(async () => {
  // Restore category_labels to its pre-test contents exactly.
  await query(`DELETE FROM category_labels`);
  for (const row of labelSnapshot) {
    await query(`INSERT INTO category_labels (kind, label) VALUES ($1, $2)`, [row.kind, row.label]);
  }
  await closePool();
});

describe("category labels (F6-S5a, real Postgres)", () => {
  it("renameCategory upserts and getCategoryLabels reads it back", async () => {
    await renameCategory({ kind: "character", label: "Cast" });
    const labels = await getCategoryLabels();
    expect(labels.find((l) => l.kind === "character")?.label).toBe("Cast");

    // Second rename overwrites (upsert on the PK), not a duplicate.
    await renameCategory({ kind: "character", label: "Dramatis" });
    const after = await getCategoryLabels();
    expect(after.filter((l) => l.kind === "character")).toHaveLength(1);
    expect(after.find((l) => l.kind === "character")?.label).toBe("Dramatis");
  });

  it("renameCategory trims and treats a blank label as a no-op (no blank row)", async () => {
    await renameCategory({ kind: "world", label: "   " });
    const labels = await getCategoryLabels();
    expect(labels.find((l) => l.kind === "world")).toBeUndefined(); // lock: no blank upsert
  });

  it("resetCategoryLabel deletes the override row (idempotent)", async () => {
    await renameCategory({ kind: "lore", label: "Legends" });
    expect((await getCategoryLabels()).find((l) => l.kind === "lore")?.label).toBe("Legends");

    await resetCategoryLabel("lore");
    expect((await getCategoryLabels()).find((l) => l.kind === "lore")).toBeUndefined();
    await resetCategoryLabel("lore"); // no-op, no throw
    expect((await getCategoryLabels()).find((l) => l.kind === "lore")).toBeUndefined();
  });
});

describe("deleteCategory bulk soft-delete (F6-S5a, real Postgres)", () => {
  it("soft-deletes ALL live entries of the kind and NONE of other kinds", async () => {
    const charA = await freshEntry("character", "people", "Cast A");
    const charB = await freshEntry("character", "people", "Cast B");
    const world = await freshEntry("world", "places", "Keep");

    const count = await deleteCategory({ kind: "character", deletedAt: Date.now() }, CONFIRM);
    expect(count).toBeGreaterThanOrEqual(2); // at least our two chars

    const liveIds = new Set((await getAllEntries()).map((e) => e.id));
    expect(liveIds.has(charA)).toBe(false); // both directions: kind gone
    expect(liveIds.has(charB)).toBe(false);
    expect(liveIds.has(world)).toBe(true); // other kind untouched
  });

  it("is idempotent: re-running does not re-stamp already-deleted rows", async () => {
    const id = await freshEntry("world", "places", "Twice");
    await deleteCategory({ kind: "world", deletedAt: 1000 }, CONFIRM);
    // A separate later soft-delete stamp must NOT overwrite the first (guarded).
    const second = await deleteCategory({ kind: "world", deletedAt: 2000 }, CONFIRM);
    // Our row was already deleted, so it is not counted again by the guard.
    void second;
    const row = await query<{ deleted_at: string | null }>(
      `SELECT deleted_at FROM entries WHERE id = $1`,
      [id],
    );
    expect(row.rows[0]!.deleted_at).toBe("1000"); // lock: first stamp preserved
  });

  it("TOMBSTONE SURVIVAL: facts/ties of a deleted entry still exist (not cascaded)", async () => {
    const person = await freshEntry("character", "people", "Doomed");
    const other = await freshEntry("world", "places", "Anchor");
    const factId = `test-f6s5-${randomUUID()}`;
    await insertFact(
      { id: factId, entryId: person, key: "role", value: "hero", fresh: false, sortOrder: 0 },
      CONFIRM,
    );
    const tieId = `test-f6s5-${randomUUID()}`;
    await insertTie({ id: tieId, fromEntryId: other, toEntryId: person, rel: "knows" }, CONFIRM);

    await deleteCategory({ kind: "character", deletedAt: Date.now() }, CONFIRM);

    // Row survives (only deleted_at set) so the S2 tombstone badge renders.
    const factRows = await query(`SELECT id FROM facts WHERE id = $1`, [factId]);
    const tieRows = await query(`SELECT id FROM ties WHERE id = $1`, [tieId]);
    expect(factRows.rows).toHaveLength(1); // lock: NOT cascade-deleted
    expect(tieRows.rows).toHaveLength(1);

    // Clean the tie/fact we made (afterEach handles the entries + their refs).
    await query(`DELETE FROM ties WHERE id = $1`, [tieId]);
    await query(`DELETE FROM facts WHERE id = $1`, [factId]);
  });
});
