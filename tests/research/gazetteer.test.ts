import { describe, it, expect } from "vitest";
import { buildGazetteer } from "@/lib/research/gazetteer";
import type { EntryWithDetails, FactRow, Kind } from "@/lib/domain/types";

// Minimal EntryWithDetails factory — name/kind/summary/facts are load-bearing for
// the rendered line; the rest are inert defaults so the shape type-checks.
function entry(
  id: string,
  kind: Kind,
  extra: { name?: string; summary?: string; facts?: FactRow[] } = {},
): EntryWithDetails {
  return {
    id,
    kind,
    name: extra.name ?? id,
    catalogueNo: "",
    note: "",
    summary: extra.summary ?? "",
    shelf: "people",
    sortOrder: 0,
    facts: extra.facts ?? [],
    ties: [],
    appearances: [],
    openQuestions: [],
  };
}

function fact(key: string, value: string): FactRow {
  return { id: `${key}`, entryId: "e", key, value, fresh: false, sortOrder: 0 };
}

// One entry of every kind present in the wiki. F5 = FULLY FREE: the gazetteer
// must render ALL of them, regardless of kind (no scope narrowing).
const ALL_KINDS: EntryWithDetails[] = [
  entry("c1", "character", { name: "Alice" }),
  entry("w1", "world", { name: "Rivertown" }),
  entry("o1", "organization", { name: "The Guild" }),
  entry("l1", "lore", { name: "The Old War" }),
];

describe("buildGazetteer (F5 fully-free — ALL entries, no scope narrowing)", () => {
  // LOCKED LINE 1: gazetteer built from FULL entries. A scope filter creeping
  // back in would drop out-of-kind entry names — this asserts every kind's name
  // survives, so a re-narrowing mutant goes RED.
  it("includes an entry of every kind present in the input", () => {
    const g = buildGazetteer(ALL_KINDS);
    expect(g).toContain("Alice");
    expect(g).toContain("Rivertown");
    expect(g).toContain("The Guild");
    expect(g).toContain("The Old War");
    // Exactly one line per entry — nothing silently dropped.
    expect(g.split("\n")).toHaveLength(ALL_KINDS.length);
  });

  it("renders one line per entry as '- name (kind)'", () => {
    const g = buildGazetteer([entry("c1", "character", { name: "Alice" })]);
    expect(g).toBe("- Alice (character)");
  });

  it("appends the summary after an em dash when present", () => {
    const g = buildGazetteer([
      entry("c1", "character", { name: "Alice", summary: "A wandering scribe" }),
    ]);
    expect(g).toBe("- Alice (character) — A wandering scribe");
  });

  it("appends facts as 'key: value; ...' in square brackets", () => {
    const g = buildGazetteer([
      entry("c1", "character", {
        name: "Alice",
        facts: [fact("age", "30"), fact("home", "Rivertown")],
      }),
    ]);
    expect(g).toBe("- Alice (character) [age: 30; home: Rivertown]");
  });

  it("returns an empty string for no entries", () => {
    expect(buildGazetteer([])).toBe("");
  });
});
