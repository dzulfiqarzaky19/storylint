import { describe, it, expect } from "vitest";
import { synthesizeResolvedTarget } from "@/lib/research/synthesizeResolvedTarget";

// The /research modal default mirrors the old strip's decision: enrich the F6
// recommendation when one matched, else propose-by-name mint (id XOR
// proposeName, never both). fact seeds {key: title, value: body}. These pin
// that shape so a mutation to either branch goes RED.

const card = { title: "Kelda", body: "storm-grey eyes", asKind: "character" };

describe("synthesizeResolvedTarget — enrich vs mint default", () => {
  it("recommendation present -> ENRICH: entry.id set, no proposeName", () => {
    const out = synthesizeResolvedTarget(card, {
      entryId: "entry-7",
      name: "Kelda",
    });
    expect(out.entry.id).toBe("entry-7");
    expect(out.entry.proposeName).toBeUndefined();
    expect(out.entry.proposeKind).toBeUndefined();
  });

  it("no recommendation -> MINT: proposeName+proposeKind by title, no id", () => {
    const out = synthesizeResolvedTarget(card, null);
    expect(out.entry.id).toBeUndefined();
    expect(out.entry.proposeName).toBe("Kelda");
    expect(out.entry.proposeKind).toBe("character");
  });

  it("category id == kind; fact seeds key=title, value=body", () => {
    const out = synthesizeResolvedTarget(card, null);
    expect(out.category.id).toBe("character");
    expect(out.fact).toEqual({ key: "Kelda", value: "storm-grey eyes" });
  });

  it("unknown asKind falls back to lore (never an out-of-union kind)", () => {
    const out = synthesizeResolvedTarget(
      { ...card, asKind: "spell" },
      null,
    );
    expect(out.category.id).toBe("lore");
    expect(out.entry.proposeKind).toBe("lore");
  });
});
