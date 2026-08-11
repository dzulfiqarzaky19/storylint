import { describe, it, expect } from "vitest";
import { canSubmitName } from "@/components/wiki/nameGate";

// WorldSwitcher's naming dialog (create universe/series/book) may only submit a
// NON-EMPTY, non-whitespace name. Both the Create button's `disabled` and the
// form's submit `if` guard key off THIS pure predicate, so a regression here
// moves the real safety net (an empty name can never create a world). The repo
// has no DOM test env, so the gate is proven here and the wiring by a Firefox
// drive (same split as shelfState.ts / focusTrap.ts).
describe("canSubmitName", () => {
  it("accepts a real name", () => {
    expect(canSubmitName("Ashkeld")).toBe(true);
  });

  it("accepts a name with surrounding whitespace (it gets trimmed to non-empty)", () => {
    expect(canSubmitName("  Ashkeld  ")).toBe(true);
  });

  it("REJECTS an empty string", () => {
    expect(canSubmitName("")).toBe(false);
  });

  it("REJECTS a whitespace-only string (spaces, tabs, newlines)", () => {
    expect(canSubmitName("   ")).toBe(false);
    expect(canSubmitName("\t")).toBe(false);
    expect(canSubmitName("\n\r ")).toBe(false);
  });
});
