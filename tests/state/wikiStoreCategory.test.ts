// F6-S5b — reducer coverage for the category actions (RENAME/RESET/DELETE).
// The reducer is the SESSION source of truth; each action fires ALONGSIDE its
// matching server action (renameCategory / resetCategoryLabel / deleteCategory).
//
// Mutation-locked lines:
//  * deleteCategoryInState filter `e.kind === kind` — soft-deletes EXACTLY the
//    named kind. Flip to `!==` and the WRONG kinds vanish while the target
//    survives -> the "kind gone / others survive" assertions go RED.
//  * fan-out over `byId` (LIVE entries only), not `order`: a re-dispatch on an
//    already-emptied kind is a structural no-op. Fanning over `order` (which is
//    also emptied) is equivalent here, so the lock is the no-op + wrong-set flip.
// RENAME/RESET route through the applyCategory* pure helpers (locked in
// tests/wiki/categoryLabels.test.ts); here we assert the reducer wires them
// into state.overrides correctly.

import { describe, it, expect } from "vitest";
import {
  initWikiState,
  wikiReducer,
  type WikiState,
} from "@/lib/state/wikiStore";
import type {
  WikiSnapshot,
  EntryWithDetails,
  Kind,
  Shelf,
  CategoryRow,
} from "@/lib/domain/types";
import { KIND_SHELF, SHELF_TITLES } from "@/lib/domain/types";

function entry(id: string, name: string, kind: Kind): EntryWithDetails {
  return {
    id,
    kind,
    name,
    catalogueNo: "—",
    note: "",
    summary: "",
    shelf: KIND_SHELF[kind],
    sortOrder: 0,
    facts: [],
    ties: [],
    appearances: [],
    openQuestions: [],
    deletedAt: null,
  };
}

function stateOf(
  entries: EntryWithDetails[],
  overrides = {},
  categories: CategoryRow[] = [],
): WikiState {
  const byId: Record<string, EntryWithDetails> = {};
  for (const e of entries) byId[e.id] = e;
  const snapshot: WikiSnapshot = { entries, byId, overrides, categories };
  return initWikiState(snapshot);
}

function cat(
  id: string,
  label: string,
  sortOrder: number,
  shelf: Shelf = "people",
  isBuiltin = false,
): CategoryRow {
  return { id, label, shelf, sortOrder, isBuiltin, deletedAt: null };
}

describe("RENAME_CATEGORY / RESET_CATEGORY", () => {
  it("RENAME_CATEGORY sets a trimmed override in state", () => {
    const s = stateOf([entry("a", "Ana", "character")]);
    const next = wikiReducer(s, { type: "RENAME_CATEGORY", kind: "character", label: "  Cast  " });
    expect(next.overrides.character).toBe("Cast");
  });

  it("RENAME_CATEGORY with a blank label resets the override (no blank stored)", () => {
    const s = stateOf([entry("a", "Ana", "character")], { character: "Cast" });
    const next = wikiReducer(s, { type: "RENAME_CATEGORY", kind: "character", label: "   " });
    expect(next.overrides.character).toBeUndefined();
  });

  it("RESET_CATEGORY removes the override for the kind", () => {
    const s = stateOf([entry("a", "Ana", "character")], { character: "Cast" });
    const next = wikiReducer(s, { type: "RESET_CATEGORY", kind: "character" });
    expect(next.overrides.character).toBeUndefined();
  });

  it("initWikiState seeds overrides from the snapshot", () => {
    const s = stateOf([entry("a", "Ana", "character")], { world: "Realms" });
    expect(s.overrides.world).toBe("Realms");
  });
});

describe("DELETE_CATEGORY (bulk soft-delete over live entries of the kind)", () => {
  it("soft-deletes ALL entries of the kind and NONE of other kinds", () => {
    const s = stateOf([
      entry("c1", "Ana", "character"),
      entry("c2", "Bo", "character"),
      entry("w1", "Keep", "world"),
    ]);
    const next = wikiReducer(s, { type: "DELETE_CATEGORY", kind: "character" });

    // Target kind is gone from byId AND from its shelf order.
    expect(next.byId.c1).toBeUndefined(); // lock: kind===k picks the right set
    expect(next.byId.c2).toBeUndefined();
    expect(next.order.people).not.toContain("c1");
    expect(next.order.people).not.toContain("c2");

    // Other kind fully survives (byId + order) — the ===→!== flip breaks this.
    expect(next.byId.w1).toBeDefined();
    expect(next.order.places).toContain("w1");
  });

  it("deselects a focused entry that was in the deleted category", () => {
    const s0 = stateOf([entry("c1", "Ana", "character")]);
    const s = wikiReducer(s0, { type: "SELECT_ENTRY", entryId: "c1" });
    expect(s.selectedEntryId).toBe("c1");
    const next = wikiReducer(s, { type: "DELETE_CATEGORY", kind: "character" });
    expect(next.selectedEntryId).toBeNull();
  });

  it("is idempotent: re-dispatching on an already-emptied kind is a structural no-op", () => {
    const s = stateOf([
      entry("c1", "Ana", "character"),
      entry("w1", "Keep", "world"),
    ]);
    const once = wikiReducer(s, { type: "DELETE_CATEGORY", kind: "character" });
    const twice = wikiReducer(once, { type: "DELETE_CATEGORY", kind: "character" });
    // Nothing of the kind remains, so the world entry + order are untouched.
    expect(twice.byId.w1).toBeDefined();
    expect(twice.order.people).toEqual([]);
    expect(twice.byId).toEqual(once.byId); // no re-removal, no throw
  });

  it("no-op when the kind has no live entries", () => {
    const s = stateOf([entry("w1", "Keep", "world")]);
    const next = wikiReducer(s, { type: "DELETE_CATEGORY", kind: "character" });
    expect(next.byId.w1).toBeDefined();
    expect(next.order.places).toContain("w1");
  });
});

// ---- F9-B S2: the full category list flows into the store -------------------
// Mutation-locked lines:
//  * initWikiState `categories: [...snapshot.categories]` — drop it and the list
//    is empty, so "init copies the list" goes RED.
//  * createCategoryInState idempotency guard `some(c.id === category.id)` — drop
//    it and a duplicate id appends, so the "no dup" length assertion goes RED.
//  * createCategoryInState `.sort((a,b) => a.sortOrder - b.sortOrder)` — drop it
//    and the appended row stays last, so the "kept sorted" order assertion RED.
//  * renameCategoryInState `c.id === kind ? { ...c, label } : c` — the label the
//    matching row carries; break the match and the row keeps its old label RED.
//  * renameCategoryInState blank branch `trimmed === "" ? shelfDefault` — a blank
//    rename resets the row label to the shelf default; break it and RED.
//  * deleteCategoryInState `.filter((c) => c.id !== kind)` — drop it and the
//    deleted category's row survives in the list, so the "row gone" test RED.

describe("initWikiState copies the full category list", () => {
  it("carries snapshot.categories onto state (built-ins + user)", () => {
    const cats = [cat("character", "People", 0, "people", true), cat("u1", "Factions", 10)];
    const s = stateOf([entry("a", "Ana", "character")], {}, cats);
    expect(s.categories.map((c) => c.id)).toEqual(["character", "u1"]);
    expect(s.categories.find((c) => c.id === "u1")?.label).toBe("Factions");
  });
});

describe("CREATE_CATEGORY", () => {
  it("appends a new category to the list", () => {
    const s = stateOf([], {}, [cat("character", "People", 0, "people", true)]);
    const next = wikiReducer(s, { type: "CREATE_CATEGORY", category: cat("u1", "Factions", 10) });
    expect(next.categories.map((c) => c.id)).toContain("u1");
    expect(next.categories.find((c) => c.id === "u1")?.label).toBe("Factions");
  });

  it("is idempotent: re-adding the same id does NOT duplicate", () => {
    const s = stateOf([], {}, [cat("u1", "Factions", 10)]);
    const next = wikiReducer(s, { type: "CREATE_CATEGORY", category: cat("u1", "Factions", 10) });
    expect(next.categories.filter((c) => c.id === "u1")).toHaveLength(1);
  });

  it("keeps the list sorted by sortOrder after append", () => {
    const s = stateOf([], {}, [cat("a", "A", 0), cat("c", "C", 20)]);
    const next = wikiReducer(s, { type: "CREATE_CATEGORY", category: cat("b", "B", 10) });
    expect(next.categories.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});

describe("RENAME_CATEGORY also updates the category list", () => {
  it("sets the matching row's label to the trimmed value", () => {
    const s = stateOf(
      [entry("a", "Ana", "character")],
      {},
      [cat("character", "People", 0, "people", true), cat("world", "Places", 1, "places", true)],
    );
    const next = wikiReducer(s, { type: "RENAME_CATEGORY", kind: "character", label: "  Cast  " });
    expect(next.categories.find((c) => c.id === "character")?.label).toBe("Cast");
    // other rows untouched
    expect(next.categories.find((c) => c.id === "world")?.label).toBe("Places");
    // overrides still wired (back-compat)
    expect(next.overrides.character).toBe("Cast");
  });

  it("a blank rename resets the row label to the shelf default", () => {
    const s = stateOf(
      [entry("a", "Ana", "character")],
      { character: "Cast" },
      [cat("character", "Cast", 0, "people", true)],
    );
    const next = wikiReducer(s, { type: "RENAME_CATEGORY", kind: "character", label: "   " });
    expect(next.categories.find((c) => c.id === "character")?.label).toBe(SHELF_TITLES.people);
    expect(next.overrides.character).toBeUndefined();
  });
});

describe("DELETE_CATEGORY also removes the category row", () => {
  it("drops the deleted category's row from the list", () => {
    const s = stateOf(
      [entry("c1", "Ana", "character")],
      {},
      [cat("character", "People", 0, "people", true), cat("world", "Places", 1, "places", true)],
    );
    const next = wikiReducer(s, { type: "DELETE_CATEGORY", kind: "character" });
    expect(next.categories.map((c) => c.id)).not.toContain("character");
    // sibling category row survives
    expect(next.categories.map((c) => c.id)).toContain("world");
  });
});
