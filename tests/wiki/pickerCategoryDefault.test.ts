import { describe, expect, it } from "vitest";
import { pickerCategoryDefault } from "@/components/wiki/WikiTargetPicker";
import type { ResolvedTarget } from "@/lib/check";

// -----------------------------------------------------------------------------
// pickerCategoryDefault — the "Add to the wiki" modal's default category id, by
// precedence. PURE. This ordering shipped INVERTED once (categories[0] ahead of
// entry.proposeKind), which defaulted EVERY /write ai-new-entity mark to the first
// live pill ("People") regardless of the mark's resolved kind — a "New
// organization" mark defaulted to People instead of Orders. /research never hit it
// because synthesizeResolvedTarget always supplies category.id, so the bug was
// latent until /write became the first proposeKind-only consumer.
//
// These lock the four precedence tiers so a re-inversion goes RED here instead of
// on a live screen: category.id > entry.proposeKind > categories[0] > "lore".
// -----------------------------------------------------------------------------

const CATEGORIES = [
  { id: "character", label: "People" },
  { id: "organization", label: "Orders" },
  { id: "lore", label: "Lore" },
];

function target(overrides: Partial<ResolvedTarget>): ResolvedTarget {
  return {
    category: {},
    entry: {},
    ...overrides,
  } as ResolvedTarget;
}

describe("pickerCategoryDefault — category default precedence", () => {
  it("1) an explicit category.id wins over everything (ENRICH / research path)", () => {
    const rt = target({
      category: { id: "lore" },
      entry: { proposeKind: "organization" },
    });
    expect(pickerCategoryDefault(rt, CATEGORIES)).toBe("lore");
  });

  it("2) entry.proposeKind beats the first live pill — the smart default per mark", () => {
    // The regression case: a proposeKind-only target (no category.id) must NOT
    // fall through to categories[0] ("character"/People).
    const rt = target({ entry: { proposeKind: "organization" } });
    expect(pickerCategoryDefault(rt, CATEGORIES)).toBe("organization");
  });

  it("2b) proposeKind 'lore' still beats categories[0], not just non-first kinds", () => {
    const rt = target({ entry: { proposeKind: "lore" } });
    expect(pickerCategoryDefault(rt, CATEGORIES)).toBe("lore");
  });

  it("3) categories[0] is the fallback only when neither id nor proposeKind resolved", () => {
    const rt = target({});
    expect(pickerCategoryDefault(rt, CATEGORIES)).toBe("character");
  });

  it("4) 'lore' backstops an empty category list with no resolved id/kind", () => {
    const rt = target({});
    expect(pickerCategoryDefault(rt, [])).toBe("lore");
  });
});
