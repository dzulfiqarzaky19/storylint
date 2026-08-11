import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import {
  insertEntry,
  insertFact,
  insertTie,
  createCategory,
  getMaxCategorySortOrder,
  renameCategory,
  resetCategoryLabel,
  deleteCategory,
} from "@/lib/db/mutations";
import { getAllEntries, getCategories } from "@/lib/db/queries";
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
// F9-B categories — rename/reset/create + "delete category" (INTEGRATION, real
// Postgres). F9-B replaced the fixed kind enum + `category_labels` override
// table with a user-extensible `categories` table whose 4 built-ins have ids
// EQUAL to the legacy kind strings.
//
// Behavior locks proven against real SQL (a pure/mock test cannot catch a SQL
// string change):
//  * renameCategory UPDATEs categories.label (read back via getCategories) +
//    blank no-op (never blanks a header).
//  * resetCategoryLabel restores a built-in's shelf-default label (idempotent),
//    and is a no-op for a user category.
//  * createCategory inserts a live user row on a shelf with the next sort_order
//    (appended after every built-in), and is idempotent on the id.
//  * deleteCategory = bulk soft-delete of ONE category's LIVE entries: BOTH
//    directions (that kind gone, other kinds untouched), idempotent on the
//    `AND deleted_at IS NULL` guard, and TOMBSTONE SURVIVAL — facts/ties rows
//    are NOT cascade-deleted (only deleted_at set), so S2 badges still render.
//
// SHARED-DB HYGIENE: throwaway entry ids (`test-f9b-<uuid>`) and throwaway
// category ids (`test-f9bcat-<uuid>`) are hard-deleted in afterEach. The 4
// built-in category LABELS are shared with the seed, so they are SNAPSHOTTED in
// beforeAll and RESTORED in afterAll — this spec must never leave a renamed
// built-in behind. deleteCategory bulk soft-deletes whole KINDS, which also hits
// real seed entries, so the set of live non-throwaway ids is snapshotted in
// beforeAll and any it soft-deletes are resurrected (deleted_at -> NULL) in
// afterEach. closePool in afterAll.
// -----------------------------------------------------------------------------

loadEnv();

const CONFIRM = confirmWikiWrite({ confirmed: true });
const created: string[] = [];
const createdCategories: string[] = [];
let labelSnapshot: { id: string; label: string }[] = [];
// The ids of every entry that is LIVE (deleted_at IS NULL) and NOT a throwaway
// at the start of the run. The deleteCategory tests bulk soft-delete whole kinds
// against the SHARED live DB, which catches these real SEED rows; afterEach must
// resurrect exactly and only these, so live counts do not drift run-to-run.
let liveSeedIds: string[] = [];

async function freshEntry(kind: Kind, shelf: Shelf, name: string): Promise<string> {
  const id = `test-f9b-${randomUUID()}`;
  await insertEntry(
    { id, kind, name, catalogueNo: "TEST", note: "", summary: "", shelf, sortOrder: 999 },
    CONFIRM,
  );
  created.push(id);
  return id;
}

/** Read one category's current label from the live categories table. */
async function labelOf(id: string): Promise<string | undefined> {
  const cats = await getCategories();
  return cats.find((c) => c.id === id)?.label;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  // Snapshot the 4 built-in category labels so we can restore them exactly.
  labelSnapshot = (
    await query<{ id: string; label: string }>(
      `SELECT id, label FROM categories WHERE is_builtin = true`,
    )
  ).rows;
  // Snapshot which real (non-throwaway) entries are LIVE now, so afterEach can
  // resurrect exactly those the deleteCategory tests soft-delete.
  liveSeedIds = (
    await query<{ id: string }>(
      `SELECT id FROM entries WHERE deleted_at IS NULL AND id NOT LIKE 'test-f9b-%'`,
    )
  ).rows.map((r) => r.id);
});

afterEach(async () => {
  while (created.length > 0) {
    const id = created.pop()!;
    await query(`DELETE FROM ties WHERE from_entry_id = $1 OR to_entry_id = $1`, [id]);
    await query(`DELETE FROM facts WHERE entry_id = $1`, [id]);
    await query(`DELETE FROM entries WHERE id = $1`, [id]);
  }
  while (createdCategories.length > 0) {
    const id = createdCategories.pop()!;
    await query(`DELETE FROM categories WHERE id = $1`, [id]);
  }
  // Restore the 4 built-in labels between tests (rename/reset mutate them).
  for (const row of labelSnapshot) {
    await query(`UPDATE categories SET label = $2 WHERE id = $1`, [row.id, row.label]);
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
  // Restore built-in labels to their pre-test contents exactly.
  for (const row of labelSnapshot) {
    await query(`UPDATE categories SET label = $2 WHERE id = $1`, [row.id, row.label]);
  }
  await closePool();
});

describe("category rename/reset/create (F9-B, real Postgres)", () => {
  it("renameCategory UPDATEs the categories row and getCategories reads it back", async () => {
    await renameCategory({ kind: "character", label: "Cast" });
    expect(await labelOf("character")).toBe("Cast");

    // Second rename overwrites in place (UPDATE, not a duplicate row).
    await renameCategory({ kind: "character", label: "Dramatis" });
    const cats = await getCategories();
    expect(cats.filter((c) => c.id === "character")).toHaveLength(1);
    expect(cats.find((c) => c.id === "character")?.label).toBe("Dramatis");
  });

  it("renameCategory trims and treats a blank label as a no-op (header not blanked)", async () => {
    const before = await labelOf("world");
    await renameCategory({ kind: "world", label: "   " });
    expect(await labelOf("world")).toBe(before); // lock: no blank write
  });

  it("resetCategoryLabel restores a built-in's shelf default (idempotent)", async () => {
    await renameCategory({ kind: "lore", label: "Legends" });
    expect(await labelOf("lore")).toBe("Legends");

    await resetCategoryLabel("lore");
    expect(await labelOf("lore")).toBe("Lore"); // shelf default restored
    await resetCategoryLabel("lore"); // no-op, no throw
    expect(await labelOf("lore")).toBe("Lore");
  });

  it("createCategory inserts a live user row appended after every built-in", async () => {
    const id = `test-f9bcat-${randomUUID()}`;
    createdCategories.push(id);
    const nextSort = await getMaxCategorySortOrder();
    const row = await createCategory({ id, label: "Artifacts", shelf: "places", sortOrder: nextSort });

    expect(row.id).toBe(id);
    expect(row.label).toBe("Artifacts");
    expect(row.shelf).toBe("places");
    expect(row.isBuiltin).toBe(false);
    expect(row.deletedAt).toBeNull();
    // Appended: its sort_order is strictly greater than every built-in's.
    const cats = await getCategories();
    const maxBuiltin = Math.max(...cats.filter((c) => c.isBuiltin).map((c) => c.sortOrder));
    expect(row.sortOrder).toBeGreaterThan(maxBuiltin);
    // And it is live in the ordered read.
    expect(cats.find((c) => c.id === id)?.label).toBe("Artifacts");
  });

  it("createCategory is idempotent on the id (retry returns the existing row)", async () => {
    const id = `test-f9bcat-${randomUUID()}`;
    createdCategories.push(id);
    const first = await createCategory({ id, label: "First", shelf: "lore", sortOrder: 100 });
    // A retry with a DIFFERENT label must not clobber and must not PK-violate.
    const second = await createCategory({ id, label: "Second", shelf: "lore", sortOrder: 200 });
    expect(second.id).toBe(id);
    expect(second.label).toBe(first.label); // lock: original label preserved
    const cats = await getCategories();
    expect(cats.filter((c) => c.id === id)).toHaveLength(1); // no duplicate
  });
});

describe("deleteCategory bulk soft-delete (F9-B, real Postgres)", () => {
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
    const factId = `test-f9b-${randomUUID()}`;
    await insertFact(
      { id: factId, entryId: person, key: "role", value: "hero", fresh: false, sortOrder: 0 },
      CONFIRM,
    );
    const tieId = `test-f9b-${randomUUID()}`;
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
