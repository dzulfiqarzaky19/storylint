// F6-S5a — pure category-label resolver. This is the ONE place the header text
// is decided (custom override vs shelf default), so it carries the mutation lock.
//
// Mutation-locked lines in resolveCategoryLabel:
//  * the coalesce `override ?? default` — return the DEFAULT instead of the
//    override and the "custom label wins" assertion goes RED.
//  * the empty-guard `override.trim() !== ""` — drop it and a blank rename would
//    blank the header instead of falling back -> the "blank falls back" test RED.

import { describe, it, expect } from "vitest";
import { resolveCategoryLabel } from "@/lib/wiki/categoryLabels";
import { SHELF_TITLES, KIND_SHELF } from "@/lib/domain/types";

describe("resolveCategoryLabel", () => {
  it("returns the custom override when one is set", () => {
    const label = resolveCategoryLabel("character", { character: "Cast" });
    expect(label).toBe("Cast"); // lock: coalesce must prefer the override
  });

  it("falls back to the shelf default when no override exists", () => {
    expect(resolveCategoryLabel("character", {})).toBe(SHELF_TITLES.people);
    expect(resolveCategoryLabel("world", {})).toBe(SHELF_TITLES.places);
    expect(resolveCategoryLabel("organization", {})).toBe(SHELF_TITLES.orders);
    expect(resolveCategoryLabel("lore", {})).toBe(SHELF_TITLES.lore);
  });

  it("uses the default via KIND_SHELF for every kind", () => {
    for (const kind of ["character", "world", "organization", "lore"] as const) {
      expect(resolveCategoryLabel(kind, {})).toBe(SHELF_TITLES[KIND_SHELF[kind]]);
    }
  });

  it("treats a blank/whitespace override as absent (default shows through)", () => {
    expect(resolveCategoryLabel("character", { character: "" })).toBe(SHELF_TITLES.people);
    expect(resolveCategoryLabel("character", { character: "   " })).toBe(SHELF_TITLES.people);
  });

  it("only overrides the named kind, leaving others on their default", () => {
    const overrides = { character: "Cast" };
    expect(resolveCategoryLabel("character", overrides)).toBe("Cast");
    expect(resolveCategoryLabel("world", overrides)).toBe(SHELF_TITLES.places);
  });
});
