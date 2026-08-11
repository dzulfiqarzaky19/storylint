// Track A — reducer coverage for the new manual authoring actions (edit + create).
// The reducer is the SESSION source of truth; each of these actions is fired
// ALONGSIDE its matching server action (actions/wiki.ts). These tests pin the
// pure state transitions so the UI updates instantly and correctly.

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

function snapshotOf(entries: EntryWithDetails[]): WikiSnapshot {
  const byId: Record<string, EntryWithDetails> = {};
  for (const e of entries) byId[e.id] = e;
  return { entries, byId, overrides: {}, categories: [] };
}

function stateWith(entries: EntryWithDetails[]): WikiState {
  return initWikiState(snapshotOf(entries));
}

describe("wikiReducer — EDIT_ENTRY_FIELDS", () => {
  it("updates only the provided fields, leaving others intact", () => {
    const s0 = stateWith([
      entry("e1", "Maren", "character", "people", {
        summary: "old summary",
        note: "old note",
      }),
    ]);
    const s1 = wikiReducer(s0, {
      type: "EDIT_ENTRY_FIELDS",
      entryId: "e1",
      summary: "new summary",
    });
    expect(s1.byId["e1"]!.summary).toBe("new summary");
    expect(s1.byId["e1"]!.note).toBe("old note");
    expect(s1.byId["e1"]!.name).toBe("Maren");
  });

  it("can update name and note together", () => {
    const s0 = stateWith([entry("e1", "Maren", "character", "people")]);
    const s1 = wikiReducer(s0, {
      type: "EDIT_ENTRY_FIELDS",
      entryId: "e1",
      name: "Maren Vale",
      note: "protagonist",
    });
    expect(s1.byId["e1"]!.name).toBe("Maren Vale");
    expect(s1.byId["e1"]!.note).toBe("protagonist");
  });

  it("is a no-op for an unknown entry", () => {
    const s0 = stateWith([entry("e1", "Maren", "character", "people")]);
    const s1 = wikiReducer(s0, {
      type: "EDIT_ENTRY_FIELDS",
      entryId: "nope",
      summary: "x",
    });
    expect(s1).toBe(s0);
  });
});

describe("wikiReducer — EDIT_FACT", () => {
  it("updates the key/value of a fact on its entry", () => {
    const s0 = stateWith([
      entry("e1", "Maren", "character", "people", {
        facts: [
          { id: "f1", entryId: "e1", key: "Age", value: "19", fresh: false, sortOrder: 0 },
        ],
      }),
    ]);
    const s1 = wikiReducer(s0, {
      type: "EDIT_FACT",
      entryId: "e1",
      factId: "f1",
      key: "Age",
      value: "twenty",
    });
    const f = s1.byId["e1"]!.facts.find((x) => x.id === "f1");
    expect(f?.value).toBe("twenty");
    expect(f?.key).toBe("Age");
  });

  it("updates only the provided fields on the fact", () => {
    const s0 = stateWith([
      entry("e1", "Maren", "character", "people", {
        facts: [
          { id: "f1", entryId: "e1", key: "Age", value: "19", fresh: false, sortOrder: 0 },
        ],
      }),
    ]);
    const s1 = wikiReducer(s0, {
      type: "EDIT_FACT",
      entryId: "e1",
      factId: "f1",
      value: "20",
    });
    const f = s1.byId["e1"]!.facts.find((x) => x.id === "f1");
    expect(f?.value).toBe("20");
    expect(f?.key).toBe("Age");
  });
});

describe("wikiReducer — CREATE_ENTRY", () => {
  it("adds a blank draft entry to its shelf order and byId and selects it", () => {
    const s0 = stateWith([entry("e1", "Maren", "character", "people")]);
    const s1 = wikiReducer(s0, {
      type: "CREATE_ENTRY",
      entryId: "entry-new",
      kind: "world",
      shelf: "places",
      name: "New place",
      note: "",
      summary: "",
      sortOrder: 5,
    });
    expect(s1.byId["entry-new"]).toBeDefined();
    expect(s1.byId["entry-new"]!.shelf).toBe("places");
    expect(s1.order.places).toContain("entry-new");
    expect(s1.selectedEntryId).toBe("entry-new");
    // Existing entry untouched.
    expect(s1.byId["e1"]).toBeDefined();
  });
});

describe("wikiReducer — CREATE_FACT", () => {
  it("appends a new fact to the entry", () => {
    const s0 = stateWith([
      entry("e1", "Maren", "character", "people", {
        facts: [
          { id: "f0", entryId: "e1", key: "Age", value: "19", fresh: false, sortOrder: 0 },
        ],
      }),
    ]);
    const s1 = wikiReducer(s0, {
      type: "CREATE_FACT",
      entryId: "e1",
      factId: "fact-new",
      key: "Home",
      value: "Ashkeld",
      sortOrder: 1,
    });
    const facts = s1.byId["e1"]!.facts;
    expect(facts).toHaveLength(2);
    expect(facts[1]).toMatchObject({ id: "fact-new", key: "Home", value: "Ashkeld" });
  });

  it("is a no-op for an unknown entry", () => {
    const s0 = stateWith([entry("e1", "Maren", "character", "people")]);
    const s1 = wikiReducer(s0, {
      type: "CREATE_FACT",
      entryId: "nope",
      factId: "fact-new",
      key: "k",
      value: "v",
      sortOrder: 0,
    });
    expect(s1).toBe(s0);
  });
});

describe("wikiReducer — SOFT_DELETE_ENTRY", () => {
  it("drops the entry from byId and from its shelf order", () => {
    const s0 = stateWith([
      entry("e1", "Maren", "character", "people"),
      entry("e2", "Ivo", "character", "people"),
    ]);
    const s1 = wikiReducer(s0, { type: "SOFT_DELETE_ENTRY", entryId: "e1" });
    expect(s1.byId["e1"]).toBeUndefined();
    expect(s1.order.people).toEqual(["e2"]);
    // The surviving sibling is untouched.
    expect(s1.byId["e2"]).toBe(s0.byId["e2"]);
  });

  it("deselects the entry when it was the focused one", () => {
    const s0 = stateWith([entry("e1", "Maren", "character", "people")]);
    // initWikiState focuses the first entry, so e1 is selected here.
    expect(s0.selectedEntryId).toBe("e1");
    const s1 = wikiReducer(s0, { type: "SOFT_DELETE_ENTRY", entryId: "e1" });
    expect(s1.selectedEntryId).toBeNull();
  });

  it("keeps the selection when a DIFFERENT entry is deleted", () => {
    const s0 = stateWith([
      entry("e1", "Maren", "character", "people"),
      entry("e2", "Ivo", "character", "people"),
    ]);
    // e1 is focused; deleting e2 must not change the focus.
    const s1 = wikiReducer(s0, { type: "SOFT_DELETE_ENTRY", entryId: "e2" });
    expect(s1.selectedEntryId).toBe("e1");
  });

  it("is a no-op for an unknown entry", () => {
    const s0 = stateWith([entry("e1", "Maren", "character", "people")]);
    const s1 = wikiReducer(s0, { type: "SOFT_DELETE_ENTRY", entryId: "nope" });
    expect(s1).toBe(s0);
  });
});
