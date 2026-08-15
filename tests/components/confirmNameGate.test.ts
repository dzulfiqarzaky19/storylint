import { describe, it, expect } from "vitest";
import { matchesDeleteName } from "@/components/wiki/confirmNameGate";

// The /wiki/manage "type-the-name to confirm" delete gate. The Delete button's
// `disabled` AND the confirm handler's guard both key off THIS pure predicate,
// so a regression here moves the real safety net (a destructive universe/world
// delete can only fire once the writer has retyped the EXACT name). The repo has
// no DOM test env, so the gate is proven here and the wiring by a Firefox /
// playwright drive (same split as nameGate.ts / shelfState.ts).
describe("matchesDeleteName", () => {
  it("accepts an exact match", () => {
    expect(matchesDeleteName("Ashkeld", "Ashkeld")).toBe(true);
  });

  it("accepts when only surrounding whitespace differs (both sides trimmed)", () => {
    expect(matchesDeleteName("  Ashkeld  ", "Ashkeld")).toBe(true);
    expect(matchesDeleteName("Ashkeld", "  Ashkeld  ")).toBe(true);
  });

  it("REJECTS a case mismatch (case-sensitive interior)", () => {
    expect(matchesDeleteName("ashkeld", "Ashkeld")).toBe(false);
  });

  it("REJECTS a near-miss (extra/missing interior character)", () => {
    expect(matchesDeleteName("Ashkel", "Ashkeld")).toBe(false);
    expect(matchesDeleteName("Ashkeldd", "Ashkeld")).toBe(false);
  });

  it("REJECTS an empty typed value against a real name", () => {
    expect(matchesDeleteName("", "Ashkeld")).toBe(false);
    expect(matchesDeleteName("   ", "Ashkeld")).toBe(false);
  });

  it("REJECTS an empty/whitespace TARGET even if the typed value also trims empty (never auto-arms)", () => {
    expect(matchesDeleteName("", "")).toBe(false);
    expect(matchesDeleteName("   ", "   ")).toBe(false);
  });
});
