/**
 * renameWorld / renameUniverse server-action wrappers (actions/wiki.ts).
 *
 * These wrappers sit between the manage-screen Rename UI and the DB mutation
 * layer. Their behavior-bearing responsibilities:
 *
 *   1. FORWARD the caller's fields to the correct mutation, re-keyed to the
 *      mutation's shape ({worldId,title} -> {id,title}; {universeId,name} ->
 *      {id,name}). A mis-map (e.g. passing name as title) silently renames the
 *      wrong column, so the forwarded payload is locked.
 *   2. STRUCTURAL — no confirmWikiWrite token (a rename touches no wiki
 *      entry/fact/tie), mirroring renameCategory. Locked via call arity.
 *   3. REVALIDATE `/wiki` so the switcher + world-scoped views re-render with
 *      the new name.
 *   4. Surface a mutation failure as `{ok:false, error}` prefixed `wiki.<name>`.
 *
 * We mock the DB mutation layer and next/cache (no Postgres, no Next runtime).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const renameWorldRow = vi.fn(async (_arg: unknown) => {});
const renameUniverseRow = vi.fn(async (_arg: unknown) => {});
const revalidatePath = vi.fn((_path: string) => {});

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

vi.mock("@/lib/db/mutations", () => ({
  renameWorld: (arg: unknown) => renameWorldRow(arg),
  renameUniverse: (arg: unknown) => renameUniverseRow(arg),
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
  insertEntryLinkedToWorld: vi.fn(),
  updateEntryFields: vi.fn(),
  updateFact: vi.fn(),
  getMaxSortOrderForShelf: vi.fn(),
  softDeleteEntry: vi.fn(),
  createCategory: vi.fn(),
  getMaxCategorySortOrder: vi.fn(),
  renameCategory: vi.fn(),
  resetCategoryLabel: vi.fn(),
  deleteCategory: vi.fn(),
  restoreEntry: vi.fn(),
  purgeDeletedBefore: vi.fn(),
  insertBook: vi.fn(),
  createFreshUniverse: vi.fn(),
  insertWorld: vi.fn(),
  linkEntityToWorld: vi.fn(),
  unlinkEntityFromWorld: vi.fn(),
  deleteUniverseCascade: vi.fn(),
  deleteBookCascade: vi.fn(),
  deleteWorldCascade: vi.fn(),
}));

import { renameWorld, renameUniverse } from "@/lib/actions/wiki";

beforeEach(() => {
  renameWorldRow.mockClear();
  renameUniverseRow.mockClear();
  revalidatePath.mockClear();
});

describe("renameWorld wrapper", () => {
  it("forwards {id,title} to the mutation with NO token and revalidates /wiki", async () => {
    const res = await renameWorld({ worldId: "world-1", title: "Kirn cycle" });
    expect(res).toEqual({ ok: true, data: undefined });

    expect(renameWorldRow).toHaveBeenCalledTimes(1);
    const call = renameWorldRow.mock.calls[0]!;
    expect(call.length).toBe(1); // no confirmation token minted
    expect(call[0]).toEqual({ id: "world-1", title: "Kirn cycle" });

    expect(revalidatePath).toHaveBeenCalledWith("/wiki");
  });

  it("surfaces a mutation failure as a failed ActionResult", async () => {
    renameWorldRow.mockRejectedValueOnce(new Error("db down"));
    const res = await renameWorld({ worldId: "world-1", title: "x" });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.error).toContain("wiki.renameWorld");
  });
});

describe("renameUniverse wrapper", () => {
  it("forwards {id,name} to the mutation with NO token and revalidates /wiki", async () => {
    const res = await renameUniverse({ universeId: "uni-1", name: "Ashkeld" });
    expect(res).toEqual({ ok: true, data: undefined });

    expect(renameUniverseRow).toHaveBeenCalledTimes(1);
    const call = renameUniverseRow.mock.calls[0]!;
    expect(call.length).toBe(1);
    expect(call[0]).toEqual({ id: "uni-1", name: "Ashkeld" });

    expect(revalidatePath).toHaveBeenCalledWith("/wiki");
  });

  it("surfaces a mutation failure as a failed ActionResult", async () => {
    renameUniverseRow.mockRejectedValueOnce(new Error("boom"));
    const res = await renameUniverse({ universeId: "uni-1", name: "y" });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.error).toContain("wiki.renameUniverse");
  });
});
