/**
 * TCK-017 — pure wiki scope-resolution (Universe + World cut-over).
 *
 * These tests lock the behavior-bearing scope-resolution lines that the wiki
 * header + snapshot read depend on, so the moderate gate can mutation-prove them
 * without a running server:
 *   - the active WORLD is derived 1:1 as `world-${activeUniverseId}`.
 *   - the active BOOK defaults to DEFAULT_BOOK_ID (full canon; header no longer
 *     picks a book).
 *   - an unknown/absent universe param falls back to the default universe, never
 *     a broken empty scope.
 */

import { describe, it, expect } from "vitest";
import { resolveWikiScope } from "@/app/wiki/scope";
import { DEFAULT_UNIVERSE_ID, DEFAULT_BOOK_ID } from "@/lib/db/scope";
import type { WorldUniverseNode } from "@/lib/db/queries";

const tree: WorldUniverseNode[] = [
  { id: DEFAULT_UNIVERSE_ID, name: "Ashkeld", series: [] },
  { id: "universe-2", name: "Second World", series: [] },
];

describe("resolveWikiScope (TCK-017)", () => {
  it("derives the active world 1:1 as `world-${universeId}` for the chosen universe", () => {
    const scope = resolveWikiScope(tree, "universe-2");
    expect(scope.activeUniverseId).toBe("universe-2");
    expect(scope.activeWorldId).toBe("world-universe-2");
  });

  it("defaults the active book to DEFAULT_BOOK_ID (header no longer picks a book)", () => {
    const scope = resolveWikiScope(tree, "universe-2");
    expect(scope.activeBookId).toBe(DEFAULT_BOOK_ID);
  });

  it("falls back to the DEFAULT universe when the url param is unknown", () => {
    const scope = resolveWikiScope(tree, "universe-does-not-exist");
    expect(scope.activeUniverseId).toBe(DEFAULT_UNIVERSE_ID);
    expect(scope.activeWorldId).toBe(`world-${DEFAULT_UNIVERSE_ID}`);
  });

  it("falls back to the DEFAULT universe when the url param is absent", () => {
    const scope = resolveWikiScope(tree, undefined);
    expect(scope.activeUniverseId).toBe(DEFAULT_UNIVERSE_ID);
    expect(scope.activeWorldId).toBe(`world-${DEFAULT_UNIVERSE_ID}`);
  });

  it("world id tracks the universe (never hardcoded to the default) when a non-default universe is chosen", () => {
    // Guards against a regression that pins the world to the default universe:
    // the world MUST follow whichever universe resolved.
    const scope = resolveWikiScope(tree, "universe-2");
    expect(scope.activeWorldId).not.toBe(`world-${DEFAULT_UNIVERSE_ID}`);
  });
});
