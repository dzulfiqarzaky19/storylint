// F6-S4b — reducer coverage for the tie authoring actions (UNTIE + CREATE_TIED).
// The reducer is the SESSION source of truth; each action is fired ALONGSIDE its
// matching server action (actions/wiki.ts untie / createEntryTied). These tests
// pin the pure state transitions so the Ties block updates instantly.
//
// Mutation-locked lines:
//  * untieInState filter `t.id !== tieId` — removes EXACTLY the addressed tie.
//    Flip to `t.id === tieId` and it drops every OTHER tie and keeps the target
//    -> the "only the addressed tie is gone" assertions go RED.
//  * createTiedInState carries the user-set `rel` into the appended tie. Drop it
//    and the tie loses its label -> the rel assertion goes RED.

import { describe, it, expect } from "vitest";
import {
  initWikiState,
  wikiReducer,
  type WikiState,
} from "@/lib/state/wikiStore";
import type {
  WikiSnapshot,
  EntryWithDetails,
  ResolvedTie,
  Kind,
  Shelf,
} from "@/lib/domain/types";

function entry(
  id: string,
  name: string,
  kind: Kind,
  shelf: Shelf,
  extra: Partial<EntryWithDetails> = {},
): EntryWithDetails {
  return {
    id,
    kind,
    name,
    catalogueNo: "—",
    note: "",
    summary: "",
    shelf,
    sortOrder: 0,
    facts: [],
    ties: [],
    appearances: [],
    openQuestions: [],
    deletedAt: null,
    ...extra,
  };
}

function tie(id: string, from: string, to: string, toName: string, rel: string): ResolvedTie {
  return {
    id,
    fromEntryId: from,
    toEntryId: to,
    rel,
    toName,
    toKind: "character",
    toCatalogueNo: "—",
  };
}

function snapshotOf(entries: EntryWithDetails[]): WikiSnapshot {
  const byId: Record<string, EntryWithDetails> = {};
  for (const e of entries) byId[e.id] = e;
  return { entries, byId, overrides: {}, categories: [] };
}

function stateWith(entries: EntryWithDetails[]): WikiState {
  return initWikiState(snapshotOf(entries));
}

describe("wikiReducer — UNTIE", () => {
  it("removes exactly the addressed tie, leaving other ties intact", () => {
    const s0 = stateWith([
      entry("e1", "Maren", "character", "people", {
        ties: [
          tie("t1", "e1", "e2", "Aldric", "father"),
          tie("t2", "e1", "e3", "Brenna", "sister"),
        ],
      }),
      entry("e2", "Aldric", "character", "people"),
      entry("e3", "Brenna", "character", "people"),
    ]);
    const s1 = wikiReducer(s0, { type: "UNTIE", fromEntryId: "e1", tieId: "t1" });

    const ties = s1.byId["e1"]!.ties;
    expect(ties.map((t) => t.id)).toEqual(["t2"]); // t1 gone, t2 kept (lock: `!==` mutant flips this)
  });

  it("is a no-op when the tie id is not on the entry", () => {
    const s0 = stateWith([
      entry("e1", "Maren", "character", "people", {
        ties: [tie("t1", "e1", "e2", "Aldric", "father")],
      }),
      entry("e2", "Aldric", "character", "people"),
    ]);
    const s1 = wikiReducer(s0, { type: "UNTIE", fromEntryId: "e1", tieId: "nope" });
    expect(s1).toBe(s0); // reference-equal: untouched
  });

  it("is a no-op for an unknown entry", () => {
    const s0 = stateWith([entry("e1", "Maren", "character", "people")]);
    const s1 = wikiReducer(s0, { type: "UNTIE", fromEntryId: "ghost", tieId: "t1" });
    expect(s1).toBe(s0);
  });
});

describe("wikiReducer — CREATE_TIED", () => {
  it("creates the new person AND appends a tie carrying the user-set rel", () => {
    const s0 = stateWith([entry("anchor", "Maren", "character", "people")]);
    const s1 = wikiReducer(s0, {
      type: "CREATE_TIED",
      entryId: "e-fen",
      tieId: "t-fen",
      kind: "character",
      shelf: "people",
      name: "Uncle Fen",
      toEntryId: "anchor",
      rel: "uncle",
    });

    // person created + on its shelf
    expect(s1.byId["e-fen"]!.name).toBe("Uncle Fen");
    expect(s1.order.people).toContain("e-fen");

    // tie appended to the ANCHOR, pointing at the new person, with the rel label
    const ties = s1.byId["anchor"]!.ties;
    expect(ties).toHaveLength(1);
    expect(ties[0]!.id).toBe("t-fen");
    expect(ties[0]!.toEntryId).toBe("e-fen");
    expect(ties[0]!.rel).toBe("uncle"); // lock: user-set rel carried through
  });

  it("still creates the entry even if the anchor is unknown (tie half no-ops)", () => {
    const s0 = stateWith([entry("other", "Maren", "character", "people")]);
    const s1 = wikiReducer(s0, {
      type: "CREATE_TIED",
      entryId: "e-fen",
      tieId: "t-fen",
      kind: "character",
      shelf: "people",
      name: "Uncle Fen",
      toEntryId: "ghost-anchor",
      rel: "uncle",
    });
    expect(s1.byId["e-fen"]!.name).toBe("Uncle Fen"); // entry created
    expect(s1.byId["ghost-anchor"]).toBeUndefined(); // no tie on a nonexistent anchor
  });
});
