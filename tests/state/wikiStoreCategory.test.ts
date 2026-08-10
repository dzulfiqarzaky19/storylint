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
} from "@/lib/domain/types";
import { KIND_SHELF } from "@/lib/domain/types";

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

function stateOf(entries: EntryWithDetails[], overrides = {}): WikiState {
  const byId: Record<string, EntryWithDetails> = {};
  for (const e of entries) byId[e.id] = e;
  const snapshot: WikiSnapshot = { entries, byId, overrides };
  return initWikiState(snapshot);
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
