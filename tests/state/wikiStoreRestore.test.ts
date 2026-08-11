// F6-S6a — reducer coverage for RESTORE_ENTRY (the inverse of SOFT_DELETE_ENTRY).
// The reducer is the SESSION source of truth; RESTORE_ENTRY fires ALONGSIDE the
// restoreEntry server action, which reloads the now-live entry WITH details and
// hands it to the reducer to re-add.
//
// Mutation-locked lines in restoreEntryInState:
//  * re-add to byId (`{ ...byId, [entry.id]: entry }`) — drop it and the
//    "entry back in byId" assertion goes RED.
//  * append to order[entry.shelf] — drop it and "id back on its shelf" goes RED.
//  * the `!includes` idempotency guard — drop it and a double-restore duplicates
//    the id in the shelf order -> the "no duplicate on double dispatch" test RED.

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

function stateOf(entries: EntryWithDetails[]): WikiState {
  const byId: Record<string, EntryWithDetails> = {};
  for (const e of entries) byId[e.id] = e;
  const snapshot: WikiSnapshot = { entries, byId, overrides: {}, categories: [] };
  return initWikiState(snapshot);
}

describe("RESTORE_ENTRY", () => {
  it("re-adds the entry to byId and appends it to its shelf order", () => {
    // Start with only Ana live; Ben was soft-deleted (absent from state).
    const s = stateOf([entry("a", "Ana", "character")]);
    expect(s.byId.b).toBeUndefined();
    expect(s.order.people).not.toContain("b");

    const ben = entry("b", "Ben", "character");
    const next = wikiReducer(s, { type: "RESTORE_ENTRY", entry: ben });

    expect(next.byId.b).toEqual(ben); // lock: re-added to byId
    expect(next.order.people).toContain("b"); // lock: back on its shelf
    // Existing entry is untouched.
    expect(next.byId.a).toEqual(s.byId.a);
    expect(next.order.people).toContain("a");
  });

  it("appends to the correct shelf for the entry's kind (place -> places)", () => {
    const s = stateOf([]);
    const shore = entry("p", "Shore", "world"); // world -> places shelf
    const next = wikiReducer(s, { type: "RESTORE_ENTRY", entry: shore });
    expect(next.order.places).toContain("p");
    expect(next.order.people).not.toContain("p");
  });

  it("carries the full details onto the restored row (facts survive)", () => {
    const s = stateOf([]);
    const withFact: EntryWithDetails = {
      ...entry("f", "Fact Haver", "character"),
      facts: [{ id: "fx", entryId: "f", key: "eye", value: "grey", fresh: false, sortOrder: 0 }],
    };
    const next = wikiReducer(s, { type: "RESTORE_ENTRY", entry: withFact });
    expect(next.byId.f!.facts).toHaveLength(1); // lock: details re-added, not stripped
    expect(next.byId.f!.facts[0]!.value).toBe("grey");
  });

  it("does NOT duplicate the id in the shelf order on a double dispatch (idempotent)", () => {
    const s = stateOf([]);
    const ben = entry("b", "Ben", "character");
    const once = wikiReducer(s, { type: "RESTORE_ENTRY", entry: ben });
    const twice = wikiReducer(once, { type: "RESTORE_ENTRY", entry: ben });
    // lock: the !includes guard keeps a single occurrence.
    expect(twice.order.people.filter((id) => id === "b")).toHaveLength(1);
  });
});
