/**
 * T-SCOPE-2 — pure /write scope resolution (Universe + World + BOOK).
 *
 * These lock the behavior-bearing book-resolution lines the /write header +
 * chapter list depend on, so the moderate gate can mutation-prove them without a
 * running server:
 *   - the active BOOK is resolved from `?book=`, validated against the ACTIVE
 *     world's books; it falls back to that world's FIRST book (sort_order order)
 *     when `?book=` is absent or names a book outside the active world.
 *   - a `?book=` from a SIBLING world never cross-scopes (that would show the
 *     wrong book's chapters — the exact bug this ticket fixes).
 *   - universe + world resolution is delegated to resolveWikiScope (proven in
 *     wikiScope.test.ts); these assert the book layered on top.
 */

import { describe, it, expect } from "vitest";
import { resolveWriteScope } from "@/app/write/scope";
import { DEFAULT_UNIVERSE_ID, DEFAULT_BOOK_ID } from "@/lib/db/scope";
import type { WorldUniverseNode } from "@/lib/db/queries";

// Two worlds in the default universe, each with two ordered books; a second
// universe with its own world + book. Mirrors the seed shape (2 books/world).
const tree: WorldUniverseNode[] = [
  {
    id: DEFAULT_UNIVERSE_ID,
    name: "Ashkeld",
    worlds: [
      {
        id: "world-a",
        title: "World A",
        sortOrder: 0,
        books: [
          { id: "book-a1", name: "A BOOK I", sortOrder: 0 },
          { id: "book-a2", name: "A BOOK II", sortOrder: 1 },
        ],
      },
      {
        id: "world-b",
        title: "World B",
        sortOrder: 1,
        books: [
          { id: "book-b1", name: "B BOOK I", sortOrder: 0 },
          { id: "book-b2", name: "B BOOK II", sortOrder: 1 },
        ],
      },
    ],
  },
  {
    id: "universe-2",
    name: "Second",
    worlds: [
      {
        id: "world-u2",
        title: "U2 World",
        sortOrder: 0,
        books: [{ id: "book-u2", name: "U2 BOOK I", sortOrder: 0 }],
      },
    ],
  },
];

describe("resolveWriteScope book resolution from ?book=", () => {
  it("defaults to the active world's FIRST book when ?book= is absent", () => {
    const scope = resolveWriteScope(tree, DEFAULT_UNIVERSE_ID, "world-a", undefined);
    expect(scope.activeWorldId).toBe("world-a");
    expect(scope.activeBookId).toBe("book-a1");
  });

  it("selects the book named by ?book= when it belongs to the active world", () => {
    const scope = resolveWriteScope(tree, DEFAULT_UNIVERSE_ID, "world-a", "book-a2");
    expect(scope.activeBookId).toBe("book-a2");
  });

  it("ignores a ?book= that belongs to a SIBLING world (never cross-scopes)", () => {
    // book-b1 is in world-b, not the active world-a -> reject, fall back to
    // world-a's first book. Cross-scoping here would show world-b's chapters
    // under world-a — the exact 'wrong book' bug.
    const scope = resolveWriteScope(tree, DEFAULT_UNIVERSE_ID, "world-a", "book-b1");
    expect(scope.activeBookId).toBe("book-a1");
  });

  it("ignores an unknown ?book= and falls back to the first book", () => {
    const scope = resolveWriteScope(tree, DEFAULT_UNIVERSE_ID, "world-a", "book-nope");
    expect(scope.activeBookId).toBe("book-a1");
  });

  it("tracks the book of whichever WORLD resolved (book follows the world switch)", () => {
    // Switch to world-b: the default book must be world-b's first, never world-a's.
    const scope = resolveWriteScope(tree, DEFAULT_UNIVERSE_ID, "world-b", undefined);
    expect(scope.activeWorldId).toBe("world-b");
    expect(scope.activeBookId).toBe("book-b1");
    expect(scope.activeBookId).not.toBe("book-a1");
  });

  it("resolves ?book= against the ACTIVE world after a ?u= + ?w= switch", () => {
    const scope = resolveWriteScope(tree, "universe-2", "world-u2", "book-u2");
    expect(scope.activeUniverseId).toBe("universe-2");
    expect(scope.activeWorldId).toBe("world-u2");
    expect(scope.activeBookId).toBe("book-u2");
  });

  it("falls back to DEFAULT_BOOK_ID when the resolved world has no books row", () => {
    const noBooks: WorldUniverseNode[] = [
      {
        id: DEFAULT_UNIVERSE_ID,
        name: "Ashkeld",
        worlds: [{ id: "world-empty", title: "Empty", sortOrder: 0, books: [] }],
      },
    ];
    const scope = resolveWriteScope(noBooks, DEFAULT_UNIVERSE_ID, "world-empty", "book-a1");
    expect(scope.activeBookId).toBe(DEFAULT_BOOK_ID);
  });
});
