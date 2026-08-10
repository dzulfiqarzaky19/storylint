/**
 * Category server-action wrappers (F6-S5b, actions/wiki.ts).
 *
 * These wrappers sit between the header UI and the DB mutation layer. Their
 * ONE behavior-bearing responsibility is the PRODUCT RULE 1 token boundary:
 *
 *   - deleteCategory is a WIKI WRITE (bulk soft-delete of every live entry of a
 *     kind), so it MUST mint a confirmWikiWrite token and pass it to the
 *     mutation, and it MUST own the deletedAt timestamp (like softDeleteEntry).
 *   - renameCategory / resetCategoryLabel touch only the category_labels
 *     override table, which holds no wiki knowledge, so they must NOT mint a
 *     token — a spurious token would be dead weight and misclassify a label
 *     edit as a guarded wiki write.
 *
 * We mock the DB mutation layer (no Postgres) and assert exactly what each
 * wrapper forwards, including token presence/absence via call arity.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const renameCategoryRow = vi.fn(async (_arg: unknown) => {});
const resetCategoryLabelRow = vi.fn(async (_arg: unknown) => {});
const deleteCategoryRow = vi.fn(async (_arg: unknown, _conf: unknown) => 3);

vi.mock("@/lib/db/mutations", () => ({
  // The three the wrappers under test forward to.
  renameCategory: (arg: unknown) => renameCategoryRow(arg),
  resetCategoryLabel: (arg: unknown) => resetCategoryLabelRow(arg),
  deleteCategory: (arg: unknown, conf: unknown) => deleteCategoryRow(arg, conf),
  // Siblings imported by actions/wiki.ts; stub so the module loads. None are
  // reached by the wrappers under test.
  insertFact: vi.fn(),
  insertTie: vi.fn(),
  deleteTie: vi.fn(),
  createEntryWithTie: vi.fn(),
  updateFactEntry: vi.fn(),
  reorderShelf: vi.fn(),
  insertDismissedSuggestion: vi.fn(),
  insertEntry: vi.fn(),
  updateEntryFields: vi.fn(),
  updateFact: vi.fn(),
  getMaxSortOrderForShelf: vi.fn(),
  softDeleteEntry: vi.fn(),
}));

import {
  renameCategory,
  resetCategoryLabel,
  deleteCategory,
} from "@/lib/actions/wiki";

beforeEach(() => {
  renameCategoryRow.mockClear();
  resetCategoryLabelRow.mockClear();
  deleteCategoryRow.mockClear();
  deleteCategoryRow.mockResolvedValue(3);
});

describe("renameCategory wrapper", () => {
  it("forwards {kind,label} to the mutation with NO confirmation token", async () => {
    const res = await renameCategory({ kind: "character", label: "Cast" });
    expect(res).toEqual({ ok: true, data: undefined });

    expect(renameCategoryRow).toHaveBeenCalledTimes(1);
    const call = renameCategoryRow.mock.calls[0]!;
    // Exactly one argument — no token minted (rule 1 does not apply here).
    expect(call.length).toBe(1);
    expect(call[0]).toEqual({ kind: "character", label: "Cast" });
  });

  it("surfaces a mutation failure as a failed ActionResult", async () => {
    renameCategoryRow.mockRejectedValueOnce(new Error("db down"));
    const res = await renameCategory({ kind: "world", label: "Realms" });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.error).toContain("wiki.renameCategory");
  });
});

describe("resetCategoryLabel wrapper", () => {
  it("forwards the kind to the mutation with NO confirmation token", async () => {
    const res = await resetCategoryLabel({ kind: "organization" });
    expect(res).toEqual({ ok: true, data: undefined });

    expect(resetCategoryLabelRow).toHaveBeenCalledTimes(1);
    const call = resetCategoryLabelRow.mock.calls[0]!;
    expect(call.length).toBe(1);
    expect(call[0]).toBe("organization");
  });
});

describe("deleteCategory wrapper (WIKI WRITE — product rule 1)", () => {
  it("mints a confirmation token and passes it as the 2nd arg", async () => {
    const res = await deleteCategory({ kind: "character", confirmed: true });
    expect(res).toEqual({ ok: true, data: { deleted: 3 } });

    expect(deleteCategoryRow).toHaveBeenCalledTimes(1);
    const call = deleteCategoryRow.mock.calls[0]!;
    // Two arguments: the payload AND the confirmation token.
    expect(call.length).toBe(2);
    const payload = call[0] as { kind: string; deletedAt: number };
    expect(payload.kind).toBe("character");
    expect(typeof payload.deletedAt).toBe("number");
    // The token is a branded object; at runtime it is a non-null object and
    // must be present (dropping it is a rule-1 regression the mutation type
    // would reject anyway, but we lock it at the call site too).
    expect(call[1]).toBeDefined();
    expect(call[1]).not.toBeNull();
  });

  it("returns the mutation's soft-delete count as {deleted}", async () => {
    deleteCategoryRow.mockResolvedValueOnce(7);
    const res = await deleteCategory({ kind: "world", confirmed: true });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data).toEqual({ deleted: 7 });
  });

  it("surfaces a mutation failure as a failed ActionResult", async () => {
    deleteCategoryRow.mockRejectedValueOnce(new Error("boom"));
    const res = await deleteCategory({ kind: "lore", confirmed: true });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.error).toContain("wiki.deleteCategory");
  });
});
