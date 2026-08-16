// T-NAV-SCOPE — proves the header nav carries the active world (u, w) across
// surfaces and deliberately drops surface-specific axes. These lock the exact
// behavior the cross-surface "global scope" fix depends on.

import { describe, it, expect } from "vitest";
import { navHref } from "@/components/shell/navScope";

describe("navHref — cross-surface scope preservation", () => {
  it("carries both u and w onto the target surface", () => {
    // The core fix: switch world on /wiki, click write -> write inherits it.
    expect(navHref("/write", { u: "universe-ashkeld", w: "world-vosk" })).toBe(
      "/write?u=universe-ashkeld&w=world-vosk",
    );
    expect(
      navHref("/research", { u: "universe-ashkeld", w: "world-vosk" }),
    ).toBe("/research?u=universe-ashkeld&w=world-vosk");
  });

  it("carries u alone when only the universe is active", () => {
    expect(navHref("/research", { u: "universe-ashkeld" })).toBe(
      "/research?u=universe-ashkeld",
    );
  });

  it("returns the bare path when no world is active (byte-identical to old behavior)", () => {
    expect(navHref("/write", {})).toBe("/write");
    expect(navHref("/wiki", { u: undefined, w: undefined })).toBe("/wiki");
  });

  it("does NOT invent a w= when only w is somehow present without u", () => {
    // Defensive: w without u still forwards w (server validates it against the
    // resolved universe's worlds and falls back if it doesn't belong).
    expect(navHref("/write", { w: "world-vosk" })).toBe("/write?w=world-vosk");
  });

  it("emits u before w (stable order) so hrefs are deterministic", () => {
    // Locks param order: a mutant reversing the set() calls would flip this.
    const href = navHref("/wiki", { u: "u1", w: "w1" });
    expect(href.indexOf("u=")).toBeLessThan(href.indexOf("w="));
  });
});
