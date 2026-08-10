import { describe, it, expect } from "vitest";
import { filterGazetteerEntries } from "@/lib/research/filterGazetteerEntries";
import type { EntryWithDetails, Kind } from "@/lib/domain/types";

// Minimal EntryWithDetails factory — only `kind` is load-bearing for the filter;
// the rest are filled with inert defaults so the shape type-checks.
function entry(id: string, kind: Kind): EntryWithDetails {
  return {
    id,
    kind,
    name: id,
    catalogueNo: "",
    note: "",
    summary: "",
    shelf: "people",
    sortOrder: 0,
    facts: [],
    ties: [],
    appearances: [],
    openQuestions: [],
  };
}

const ENTRIES: EntryWithDetails[] = [
  entry("c1", "character"),
  entry("c2", "character"),
  entry("w1", "world"),
  entry("o1", "organization"),
  entry("l1", "lore"),
];

describe("filterGazetteerEntries", () => {
  it("returns NO entries for the 'chat' scope (broad, no wiki context)", () => {
    expect(filterGazetteerEntries(ENTRIES, "chat")).toEqual([]);
  });

  it("returns ONLY entries of the scoped kind (character)", () => {
    const result = filterGazetteerEntries(ENTRIES, "character");
    expect(result.map((e) => e.id)).toEqual(["c1", "c2"]);
    expect(result.every((e) => e.kind === "character")).toBe(true);
  });

  it("returns ONLY entries of the scoped kind (world)", () => {
    const result = filterGazetteerEntries(ENTRIES, "world");
    expect(result.map((e) => e.id)).toEqual(["w1"]);
  });

  it("returns ONLY entries of the scoped kind (organization)", () => {
    expect(filterGazetteerEntries(ENTRIES, "organization").map((e) => e.id)).toEqual([
      "o1",
    ]);
  });

  it("returns ONLY entries of the scoped kind (lore)", () => {
    expect(filterGazetteerEntries(ENTRIES, "lore").map((e) => e.id)).toEqual(["l1"]);
  });

  it("returns [] for a kind scope with no matching entries", () => {
    const onlyChars = [entry("c1", "character")];
    expect(filterGazetteerEntries(onlyChars, "world")).toEqual([]);
  });

  it("returns [] for an empty entry list under any scope", () => {
    expect(filterGazetteerEntries([], "chat")).toEqual([]);
    expect(filterGazetteerEntries([], "character")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [...ENTRIES];
    filterGazetteerEntries(input, "character");
    expect(input).toHaveLength(ENTRIES.length);
  });
});
