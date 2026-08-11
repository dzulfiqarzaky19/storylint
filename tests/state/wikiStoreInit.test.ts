// B1 — initWikiState must not 500 on an entry with an unknown shelf.
//
// Bug (candidate B1): initWikiState did `order[entry.shelf].push(entry.id)`
// unguarded, so any entry whose shelf is NOT one of people|places|orders|lore
// threw "Cannot read properties of undefined (reading 'push')" -> a 500 in the
// server component that builds the wiki index. These tests pin the defensive
// guard: an unknown-shelf entry is SKIPPED from `order` (never bucketed), while
// every valid entry buckets exactly as before (no regression).

import { describe, it, expect, vi, afterEach } from "vitest";
import { initWikiState } from "@/lib/state/wikiStore";
import type {
  WikiSnapshot,
  EntryWithDetails,
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

/** An entry whose `shelf` is deliberately outside the valid Shelf union, to
 *  model corrupt/legacy data (the type is cast because the union forbids it). */
function badShelfEntry(id: string, badShelf: string): EntryWithDetails {
  return entry(id, id, "lore", badShelf as Shelf);
}

function snapshotOf(entries: EntryWithDetails[]): WikiSnapshot {
  const byId: Record<string, EntryWithDetails> = {};
  for (const e of entries) byId[e.id] = e;
  return { entries, byId, overrides: {}, categories: [] };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("initWikiState — unknown shelf (B1)", () => {
  it("does not throw when an entry has an unknown shelf", () => {
    const snapshot = snapshotOf([badShelfEntry("bad1", "nonsense")]);
    expect(() => initWikiState(snapshot)).not.toThrow();
  });

  it("skips an unknown-shelf entry from every shelf's order", () => {
    const snapshot = snapshotOf([
      entry("p1", "Maren", "character", "people"),
      badShelfEntry("bad1", "nonsense"),
    ]);
    const state = initWikiState(snapshot);

    // The valid entry buckets; the bad one appears in NO shelf's order.
    expect(state.order.people).toEqual(["p1"]);
    expect(state.order.places).toEqual([]);
    expect(state.order.orders).toEqual([]);
    expect(state.order.lore).toEqual([]);
    const allOrdered = [
      ...state.order.people,
      ...state.order.places,
      ...state.order.orders,
      ...state.order.lore,
    ];
    expect(allOrdered).not.toContain("bad1");
  });

  it("warns identifying the entry id and its unknown shelf", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = snapshotOf([badShelfEntry("bad1", "nonsense")]);
    initWikiState(snapshot);
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0]![0]);
    expect(msg).toContain("bad1");
    expect(msg).toContain("nonsense");
  });

  it("all-valid input is byte-identical to the pre-fix behavior (no regression)", () => {
    const snapshot = snapshotOf([
      entry("p1", "Maren", "character", "people"),
      entry("p2", "Aldric", "character", "people"),
      entry("pl1", "Ashkeld", "world", "places"),
      entry("o1", "Watch", "organization", "orders"),
      entry("l1", "The Ebb", "lore", "lore"),
    ]);
    const state = initWikiState(snapshot);

    // Every valid entry buckets exactly as before, in encounter order.
    expect(state.order).toEqual({
      people: ["p1", "p2"],
      places: ["pl1"],
      orders: ["o1"],
      lore: ["l1"],
    });
    // selectedEntryId is unchanged: first entry of the snapshot.
    expect(state.selectedEntryId).toBe("p1");
  });

  it("selectedEntryId is unaffected even when the first entry has a bad shelf", () => {
    // selectedEntryId is snapshot.entries[0]?.id regardless of shelf validity;
    // the guard must not change that.
    const snapshot = snapshotOf([
      badShelfEntry("bad1", "nonsense"),
      entry("p1", "Maren", "character", "people"),
    ]);
    const state = initWikiState(snapshot);
    expect(state.selectedEntryId).toBe("bad1");
    expect(state.order.people).toEqual(["p1"]);
  });
});
