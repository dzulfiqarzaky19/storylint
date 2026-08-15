import { describe, it, expect } from "vitest";
import type { WorldUniverseNode } from "@/lib/db/queries";
import { flattenSwitcher, breadcrumbLabel } from "@/components/wiki/switcherMenu";

// The design-3a switcher menu model. The dropdown renders flattenSwitcher's
// output (universe groups + world items, one marked active) and the breadcrumb
// reflects breadcrumbLabel. A regression here mis-marks the active world or
// blanks the breadcrumb, both user-visible; the interactive dropdown itself is
// proven by the Firefox / playwright drive (same split as scopeHref.ts).

const tree: WorldUniverseNode[] = [
  {
    id: "u1",
    name: "Ashkeld",
    worlds: [
      { id: "w1", title: "Ashkeld", sortOrder: 0, books: [] },
      { id: "w2", title: "Second World", sortOrder: 1, books: [] },
    ],
  },
  {
    id: "u2",
    name: "Other Universe",
    worlds: [{ id: "w3", title: "Other World", sortOrder: 0, books: [] }],
  },
];

describe("flattenSwitcher", () => {
  it("flattens every world across every universe, in tree order", () => {
    const items = flattenSwitcher(tree, "u1", "w1");
    expect(items.map((i) => i.worldId)).toEqual(["w1", "w2", "w3"]);
    expect(items.map((i) => i.universeName)).toEqual([
      "Ashkeld",
      "Ashkeld",
      "Other Universe",
    ]);
  });

  it("marks EXACTLY the active universe+world pair as active", () => {
    const items = flattenSwitcher(tree, "u1", "w2");
    expect(items.filter((i) => i.active).map((i) => i.worldId)).toEqual(["w2"]);
  });

  it("marks nothing active when the active pair isn't present", () => {
    const items = flattenSwitcher(tree, "u1", "nope");
    expect(items.some((i) => i.active)).toBe(false);
  });

  it("does NOT mark a same-world-id under a DIFFERENT universe as active", () => {
    // Defensive: active requires BOTH ids to match, not just the world id.
    const items = flattenSwitcher(tree, "u2", "w1");
    expect(items.some((i) => i.active)).toBe(false);
  });

  it("returns an empty list for an empty tree", () => {
    expect(flattenSwitcher([], "u1", "w1")).toEqual([]);
  });
});

describe("breadcrumbLabel", () => {
  it("returns the active universe + world names", () => {
    expect(breadcrumbLabel(tree, "u1", "w2")).toEqual({
      universe: "Ashkeld",
      world: "Second World",
    });
  });

  it("falls back to the first universe/world when ids don't resolve", () => {
    expect(breadcrumbLabel(tree, "nope", "nope")).toEqual({
      universe: "Ashkeld",
      world: "Ashkeld",
    });
  });

  it("returns null for an empty tree", () => {
    expect(breadcrumbLabel([], "u1", "w1")).toBeNull();
  });
});
