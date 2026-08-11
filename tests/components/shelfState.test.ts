import { describe, it, expect } from "vitest";
import { isEmptyCategory } from "@/components/wiki/shelfState";

// The lighter empty-category treatment in Shelf.tsx (dimmed heading + a real
// "No entries yet" hint, controls kept) keys off THIS predicate. Shelf.tsx must
// call the same exported function, so a regression here moves the UI too.
describe("isEmptyCategory", () => {
  it("is true only when the category has zero entries", () => {
    expect(isEmptyCategory(0)).toBe(true);
  });

  it("is false for a populated category (one entry)", () => {
    expect(isEmptyCategory(1)).toBe(false);
  });

  it("is false for a many-entry category", () => {
    expect(isEmptyCategory(7)).toBe(false);
  });
});
