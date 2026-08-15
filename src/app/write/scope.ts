// T-SCOPE-2 — PURE scope resolution for the /write surface (Universe + World +
// Book). Extracted so the active-book default + validation are unit-testable and
// mutation-provable without a running server (page.tsx does I/O).
//
// The /write header presents ACTIVE WORLD -> ACTIVE BOOK. Universe + World are
// resolved by the SAME resolveWikiScope the /wiki + /research surfaces use (one
// resolver, no drift); this only adds the BOOK axis on top: the active book is
// the `?book=` book IF it belongs to the ACTIVE world, else that world's FIRST
// book (books are ordered by sort_order in getWorldTree). A `?book=` from a
// sibling world can never cross-scope. When the world has no books row at all
// (only possible pre-seed / an empty new world), it falls back to
// DEFAULT_BOOK_ID so the page still renders instead of 500-ing.

import type { WorldUniverseNode } from "@/lib/db/queries";
import { DEFAULT_BOOK_ID } from "@/lib/db/scope";
import { resolveWikiScope } from "@/app/wiki/scope";

/** The scope the /write header + chapter list resolve to from the URL. */
export interface WriteScope {
  activeUniverseId: string;
  activeWorldId: string;
  /**
   * T-SCOPE-2: resolved from `?book=`, validated against the ACTIVE world's
   * books; falls back to that world's FIRST book when `?book=` is absent or names
   * a book outside the active world. When the world has no books row, falls back
   * to DEFAULT_BOOK_ID (keeps the page renderable).
   */
  activeBookId: string;
}

/**
 * Resolve the active /write scope from the URL universe (`?u=`), world (`?w=`),
 * and book (`?book=`) params. Universe + world come straight from
 * resolveWikiScope (validated against the tree); the book is then validated
 * against the ACTIVE world's book list so a stale/foreign `?book=` never selects
 * a chapter set from the wrong book (the very bug this ticket fixes).
 */
export function resolveWriteScope(
  tree: WorldUniverseNode[],
  uParam: string | undefined,
  wParam: string | undefined,
  bookParam?: string | undefined,
): WriteScope {
  const { activeUniverseId, activeWorldId } = resolveWikiScope(tree, uParam, wParam);

  // The books of the resolved active world (ordered by sort_order in getWorldTree).
  // Only these are selectable, so a `?book=` from a sibling world can't cross-scope.
  const world = tree
    .find((u) => u.id === activeUniverseId)
    ?.worlds.find((w) => w.id === activeWorldId);
  const books = world?.books ?? [];
  const activeBookId =
    books.find((b) => b.id === bookParam)?.id ??
    books[0]?.id ??
    DEFAULT_BOOK_ID;

  return { activeUniverseId, activeWorldId, activeBookId };
}
