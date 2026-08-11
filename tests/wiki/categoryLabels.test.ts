// F6-S5a — pure category-label resolver. This is the ONE place the header text
// is decided (custom override vs shelf default), so it carries the mutation lock.
//
// Mutation-locked lines in resolveCategoryLabel:
//  * the coalesce `override ?? default` — return the DEFAULT instead of the
//    override and the "custom label wins" assertion goes RED.
//  * the empty-guard `override.trim() !== ""` — drop it and a blank rename would
//    blank the header instead of falling back -> the "blank falls back" test RED.

import { describe, it, expect } from "vitest";
import {
  resolveCategoryLabel,
  applyCategoryRename,
  applyCategoryReset,
  categoryLabelById,
  categorySingular,
} from "@/lib/wiki/categoryLabels";
import { SHELF_TITLES, KIND_SHELF } from "@/lib/domain/types";
import type { CategoryRow } from "@/lib/domain/types";

function cat(id: string, label: string, sortOrder = 0): CategoryRow {
  return { id, label, shelf: "people", sortOrder, isBuiltin: false, deletedAt: null };
}

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

describe("applyCategoryRename", () => {
  it("sets a trimmed non-blank label as the override for the kind", () => {
    const next = applyCategoryRename({}, "character", "  Cast  ");
    expect(next.character).toBe("Cast"); // lock: stored value is trimmed
  });

  it("OVERWRITES an existing override (upsert, not append/dup)", () => {
    const next = applyCategoryRename({ character: "Cast" }, "character", "Dramatis");
    expect(next.character).toBe("Dramatis"); // lock: upsert semantics
  });

  it("treats a whitespace-only label as a reset (removes the key, no blank stored)", () => {
    const next = applyCategoryRename({ character: "Cast" }, "character", "   ");
    expect(next.character).toBeUndefined(); // lock: blank deletes, never stores "   "
  });

  it("does not mutate the input map (pure)", () => {
    const input = { character: "Cast" };
    applyCategoryRename(input, "world", "Realms");
    expect(input).toEqual({ character: "Cast" }); // lock: non-mutating
  });

  it("leaves other kinds' overrides untouched", () => {
    const next = applyCategoryRename({ world: "Realms" }, "character", "Cast");
    expect(next.world).toBe("Realms");
    expect(next.character).toBe("Cast");
  });
});

describe("applyCategoryReset", () => {
  it("removes the kind's override so the header falls back to default", () => {
    const next = applyCategoryReset({ character: "Cast" }, "character");
    expect(next.character).toBeUndefined();
  });

  it("is idempotent when no override exists", () => {
    const next = applyCategoryReset({}, "character");
    expect(next.character).toBeUndefined();
  });

  it("round-trips: rename then reset resolves back to the shelf default", () => {
    const renamed = applyCategoryRename({}, "character", "Cast");
    expect(resolveCategoryLabel("character", renamed)).toBe("Cast");
    const reset = applyCategoryReset(renamed, "character");
    // Coherence lock: reducer reset + S5a resolver agree on the default.
    expect(resolveCategoryLabel("character", reset)).toBe(SHELF_TITLES.people);
  });
});

// F9-B S2 — the PURE list-based resolver over the full category list.
// Mutation-locked lines in categoryLabelById:
//  * `find((c) => c.id === id)` + `return row.label` — the present-row branch;
//    break the match and a present row falls through to the fallback -> RED.
//  * `id in KIND_SHELF` + `SHELF_TITLES[KIND_SHELF[id]]` — the built-in fallback;
//    drop it and an absent built-in id returns the raw id, not "People" -> RED.
//  * final `return id` — the user-category fallback when absent from the list.
describe("categoryLabelById", () => {
  it("returns the matching row's label when the id is present", () => {
    const cats = [cat("u1", "Factions"), cat("u2", "Magic Systems")];
    expect(categoryLabelById(cats, "u1")).toBe("Factions"); // lock: present-row wins
    expect(categoryLabelById(cats, "u2")).toBe("Magic Systems");
  });

  it("prefers the stored row label over the built-in default for a built-in id", () => {
    const cats = [cat("character", "Cast")];
    expect(categoryLabelById(cats, "character")).toBe("Cast");
  });

  it("falls back to the shelf default for a built-in id absent from the list", () => {
    expect(categoryLabelById([], "character")).toBe(SHELF_TITLES.people);
    expect(categoryLabelById([], "world")).toBe(SHELF_TITLES.places);
    expect(categoryLabelById([], "organization")).toBe(SHELF_TITLES.orders);
    expect(categoryLabelById([], "lore")).toBe(SHELF_TITLES.lore);
  });

  it("uses the built-in default via KIND_SHELF for every built-in id", () => {
    for (const id of ["character", "world", "organization", "lore"] as const) {
      expect(categoryLabelById([], id)).toBe(SHELF_TITLES[KIND_SHELF[id]]);
    }
  });

  it("returns the raw id for a user category absent from the list (no built-in default)", () => {
    expect(categoryLabelById([], "u-unknown")).toBe("u-unknown");
  });
});

// TCK-006 — PURE singular form for the "+ Add new <x>" add-entry affordance.
// Mutation-locked line in categorySingular:
//  * `label.replace(/s$/, "").toLowerCase()` — drop the replace and "People"
//    stays plural -> the "strips one trailing s" test RED; drop toLowerCase and
//    "Guilds" -> "Guild" (capitalized) -> the lowercase test RED.
describe("categorySingular", () => {
  it("strips one trailing s and lowercases", () => {
    expect(categorySingular("People")).toBe("people");
    expect(categorySingular("Guilds")).toBe("guild");
    expect(categorySingular("Places")).toBe("place");
  });

  it("lowercases a label with no trailing s unchanged", () => {
    expect(categorySingular("Lore")).toBe("lore");
  });

  it("strips only ONE trailing s (does not over-singularize)", () => {
    expect(categorySingular("Compass")).toBe("compas");
  });
});
