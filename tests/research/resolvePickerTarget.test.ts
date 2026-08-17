import { describe, it, expect } from "vitest";
import {
  resolvePickerTarget,
  type PickerResult,
} from "@/lib/research/resolvePickerTarget";

// The picker collapses to ONE behavior-bearing bit: entryId present -> ENRICH,
// absent -> MINT. These tests pin that bit and the exact field routing each
// branch feeds confirmCard, so a mutation to either branch goes RED.

const base: PickerResult = {
  categoryId: "character",
  entryName: "Kelda",
  factKey: "eye colour",
  factValue: "storm grey",
};

describe("resolvePickerTarget — ENRICH vs MINT", () => {
  it("entryId set -> ENRICH: enrichEntryId set, factKey->name, factValue->summary", () => {
    const out = resolvePickerTarget({ ...base, entryId: "entry-9" });
    expect(out.enrichEntryId).toBe("entry-9");
    // confirmCard's enrich branch reads entry.name AS the fact key.
    expect(out.entry.name).toBe("eye colour");
    expect(out.entry.summary).toBe("storm grey");
  });

  it("entryId absent -> MINT: no enrichEntryId, entryName->name, factValue->summary", () => {
    const out = resolvePickerTarget(base);
    expect(out.enrichEntryId).toBeUndefined();
    expect(out.entry.name).toBe("Kelda");
    expect(out.entry.summary).toBe("storm grey");
  });

  it("empty-string entryId is treated as ABSENT (mints, never enriches)", () => {
    const out = resolvePickerTarget({ ...base, entryId: "" });
    expect(out.enrichEntryId).toBeUndefined();
    expect(out.entry.name).toBe("Kelda");
  });
});

describe("resolvePickerTarget — kind narrowing", () => {
  it("built-in category id passes through as the Kind", () => {
    expect(resolvePickerTarget({ ...base, categoryId: "world" }).entry.kind).toBe(
      "world",
    );
    expect(
      resolvePickerTarget({ ...base, categoryId: "organization" }).entry.kind,
    ).toBe("organization");
  });

  it("unknown (user) category id falls back to lore, never crashes a mint", () => {
    expect(
      resolvePickerTarget({ ...base, categoryId: "cat-custom-42" }).entry.kind,
    ).toBe("lore");
  });

  it("new-category mint (empty categoryId + proposeCategoryName) still mints a valid entry", () => {
    // The picker clears categoryId to the empty sentinel and carries the new
    // name in proposeCategoryName. This pure resolver has no real id yet, so its
    // kind falls back to lore INERTLY — handleConfirm mints the real category and
    // overrides the kind with the created id. What must survive here is the mint
    // shape: no enrichEntryId, entryName -> name, factValue -> summary.
    const out = resolvePickerTarget({
      ...base,
      categoryId: "",
      proposeCategoryName: "Artifacts",
    });
    expect(out.enrichEntryId).toBeUndefined();
    expect(out.entry.name).toBe("Kelda");
    expect(out.entry.summary).toBe("storm grey");
    expect(out.entry.kind).toBe("lore");
  });
});
