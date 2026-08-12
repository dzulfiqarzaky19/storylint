/**
 * TCK-E02 — the world switcher's post-create navigation target.
 *
 * Bug: creating a 2nd world under a universe minted the world but the switcher
 * "snapped back" to the universe's FIRST world — its gazetteer showed the old
 * world's entries. Root cause: onNewWorld only called router.refresh() and never
 * navigated to the new world's ?w=, so resolveWikiScope (scope.ts) fell back to
 * worlds[0]. These tests lock the pure nav-target line so the moderate gate can
 * mutation-prove it without a running server.
 */

import { describe, it, expect } from "vitest";
import { scopeHref } from "@/components/wiki/scopeHref";

describe("scopeHref (TCK-E02 world switcher nav target)", () => {
  it("builds /wiki?u= with no ?w= when only a universe is given", () => {
    expect(scopeHref("universe-1")).toBe("/wiki?u=universe-1");
  });

  it("selects a specific world by adding ?w= (the create-world nav target)", () => {
    // This is the exact call onNewWorld must make with the freshly-created world
    // id: it lands the writer ON the new world, not the universe's first world.
    expect(scopeHref("universe-1", "world-new-42")).toBe(
      "/wiki?u=universe-1&w=world-new-42",
    );
  });

  it("carries the new world id verbatim so the server never falls back to worlds[0]", () => {
    const href = scopeHref("universe-1", "world-brand-new");
    expect(href).toContain("w=world-brand-new");
    // The regression this guards: dropping the world id (e.g. a plain refresh /
    // scopeHref(u) with no w) leaves ?w= absent and snaps back to worlds[0].
    expect(href).not.toBe("/wiki?u=universe-1");
  });
});
