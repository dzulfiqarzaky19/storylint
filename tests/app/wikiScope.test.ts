/**
 * TCK-017 + TCK-022 — pure wiki scope-resolution (Universe + World).
 *
 * These tests lock the behavior-bearing scope-resolution lines that the wiki
 * header + snapshot read depend on, so the moderate gate can mutation-prove them
 * without a running server:
 *   - TCK-022: the active WORLD is resolved from `?w=`, validated against the
 *     ACTIVE universe's worlds; it falls back to that universe's FIRST world when
 *     `?w=` is absent or names a world outside the active universe. When the
 *     universe has NO worlds row (pre-backfill), it falls back to the legacy 1:1
 *     id `world-${activeUniverseId}` so the page still renders.
 *   - the active BOOK defaults to DEFAULT_BOOK_ID (full canon; header no longer
 *     picks a book).
 *   - an unknown/absent universe param falls back to the default universe, never
 *     a broken empty scope.
 */

import { describe, it, expect } from "vitest";
import { resolveWikiScope } from "@/app/wiki/scope";
import { DEFAULT_UNIVERSE_ID, DEFAULT_BOOK_ID } from "@/lib/db/scope";
import type { WorldUniverseNode } from "@/lib/db/queries";

// Legacy tree: no `worlds` rows on either universe (pre-backfill shape). Locks
// the `world-${universeId}` fallback that keeps the page renderable.
const legacyTree: WorldUniverseNode[] = [
  { id: DEFAULT_UNIVERSE_ID, name: "Ashkeld", worlds: [] },
  { id: "universe-2", name: "Second World", worlds: [] },
];

// TCK-022 tree: the default universe has TWO worlds (ordered), universe-2 has one.
const multiWorldTree: WorldUniverseNode[] = [
  {
    id: DEFAULT_UNIVERSE_ID,
    name: "Ashkeld",
    worlds: [
      { id: "world-a", title: "World A", sortOrder: 0, books: [] },
      { id: "world-b", title: "World B", sortOrder: 1, books: [] },
    ],
  },
  {
    id: "universe-2",
    name: "Second World",
    worlds: [{ id: "world-u2", title: "U2 World", sortOrder: 0, books: [] }],
  },
];

describe("resolveWikiScope (TCK-017 universe + book)", () => {
  it("defaults the active book to DEFAULT_BOOK_ID (header no longer picks a book)", () => {
    const scope = resolveWikiScope(legacyTree, "universe-2");
    expect(scope.activeBookId).toBe(DEFAULT_BOOK_ID);
  });

  it("falls back to the DEFAULT universe when the url param is unknown", () => {
    const scope = resolveWikiScope(legacyTree, "universe-does-not-exist");
    expect(scope.activeUniverseId).toBe(DEFAULT_UNIVERSE_ID);
  });

  it("falls back to the DEFAULT universe when the url param is absent", () => {
    const scope = resolveWikiScope(legacyTree, undefined);
    expect(scope.activeUniverseId).toBe(DEFAULT_UNIVERSE_ID);
  });

  it("resolves the active universe from the url param when it exists in the tree", () => {
    const scope = resolveWikiScope(legacyTree, "universe-2");
    expect(scope.activeUniverseId).toBe("universe-2");
  });
});

describe("resolveWikiScope legacy world fallback (no worlds row = pre-backfill)", () => {
  it("falls back to `world-${universeId}` when the universe has no worlds row", () => {
    const scope = resolveWikiScope(legacyTree, "universe-2");
    expect(scope.activeWorldId).toBe("world-universe-2");
  });

  it("world id tracks the resolved universe, never pinned to the default", () => {
    // Guards a regression that pins the fallback world to the default universe:
    // the fallback MUST follow whichever universe resolved.
    const scope = resolveWikiScope(legacyTree, "universe-2");
    expect(scope.activeWorldId).not.toBe(`world-${DEFAULT_UNIVERSE_ID}`);
  });
});

describe("resolveWikiScope world resolution from ?w= (TCK-022)", () => {
  it("defaults to the active universe's FIRST world when ?w= is absent", () => {
    const scope = resolveWikiScope(multiWorldTree, DEFAULT_UNIVERSE_ID, undefined);
    // worlds are [world-a, world-b] in order; first is world-a.
    expect(scope.activeWorldId).toBe("world-a");
  });

  it("selects the world named by ?w= when it belongs to the active universe", () => {
    const scope = resolveWikiScope(multiWorldTree, DEFAULT_UNIVERSE_ID, "world-b");
    expect(scope.activeWorldId).toBe("world-b");
  });

  it("ignores a ?w= that names a world in a DIFFERENT universe (never cross-scopes)", () => {
    // world-u2 belongs to universe-2, not the active default universe -> reject,
    // fall back to the active universe's first world.
    const scope = resolveWikiScope(multiWorldTree, DEFAULT_UNIVERSE_ID, "world-u2");
    expect(scope.activeWorldId).toBe("world-a");
  });

  it("ignores an unknown ?w= and falls back to the first world", () => {
    const scope = resolveWikiScope(multiWorldTree, DEFAULT_UNIVERSE_ID, "world-nope");
    expect(scope.activeWorldId).toBe("world-a");
  });

  it("resolves ?w= against the ACTIVE universe after a ?u= switch", () => {
    const scope = resolveWikiScope(multiWorldTree, "universe-2", "world-u2");
    expect(scope.activeUniverseId).toBe("universe-2");
    expect(scope.activeWorldId).toBe("world-u2");
  });
});
