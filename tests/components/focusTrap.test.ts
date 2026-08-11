import { describe, it, expect } from "vitest";
import { nextFocusIndex } from "@/components/ui/focusTrap";

// The base Modal's Tab / Shift-Tab focus cycle (Modal.tsx) keys off THIS pure
// decision: given how many focusable elements the dialog has, which one is
// focused now, and whether Shift is held, it returns the index to focus next
// (with wraparound). Modal.tsx must call the same exported function, so a
// regression here moves the real trap. The repo has no DOM test env, so the
// wraparound math is proven here and the wiring is proven by a Firefox drive.
describe("nextFocusIndex", () => {
  // ---- Tab (forward) ------------------------------------------------------
  it("Tab advances to the next element", () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1);
    expect(nextFocusIndex(3, 1, false)).toBe(2);
  });

  it("Tab on the LAST element wraps to the first", () => {
    expect(nextFocusIndex(3, 2, false)).toBe(0);
  });

  // ---- Shift-Tab (backward) -----------------------------------------------
  it("Shift-Tab retreats to the previous element", () => {
    expect(nextFocusIndex(3, 2, true)).toBe(1);
    expect(nextFocusIndex(3, 1, true)).toBe(0);
  });

  it("Shift-Tab on the FIRST element wraps to the last", () => {
    expect(nextFocusIndex(3, 0, true)).toBe(2);
  });

  // ---- Focus currently outside the dialog (currentIndex === -1) ------------
  it("Tab with focus outside lands on the first element", () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0);
  });

  it("Shift-Tab with focus outside lands on the last element", () => {
    expect(nextFocusIndex(3, -1, true)).toBe(2);
  });

  // ---- Degenerate: single focusable element -------------------------------
  it("a single focusable element always stays on itself", () => {
    expect(nextFocusIndex(1, 0, false)).toBe(0);
    expect(nextFocusIndex(1, 0, true)).toBe(0);
  });

  // ---- Degenerate: no focusable elements ----------------------------------
  it("returns -1 when there is nothing to focus", () => {
    expect(nextFocusIndex(0, -1, false)).toBe(-1);
    expect(nextFocusIndex(0, -1, true)).toBe(-1);
  });
});
