// =============================================================================
// The active scope — ONE module (T-DEEP-5).
//
// Scope (universe -> world -> book) lives only in the URL; there is no cookie or
// storage behind it. So every surface has to read it, and every link has to
// carry it forward. That was spread across six fragments — two resolvers
// (`app/wiki/scope.ts`, `app/write/scope.ts`, one calling the other) and three
// href builders (`navScope.navHref`, `wiki/scopeHref`, an inline
// `writeChapterHref`), each hand-picking which axes to keep.
//
// Two facts had to be known independently by every one of them:
//
//   1. THE FALLBACK LADDER. A `?u=` that is not in the tree falls back to the
//      default universe, then to the first. A `?w=` is valid only INSIDE the
//      active universe — one naming a sibling universe's world is rejected, not
//      honoured — then the universe's first world, then the legacy 1:1
//      `world-<universeId>`. A `?book=` is valid only inside the active WORLD,
//      then that world's first book, then DEFAULT_BOOK_ID.
//   2. WHICH AXES SURVIVE A HOP. Carrying `?book=` to /research is meaningless;
//      DROPPING `?w=` on the way to /write silently re-scopes the destination to
//      its first world, which is how "the active world follows you across
//      surfaces" quietly broke before. That rule is now a table, not something
//      each link author remembers.
//
// A caller resolves once and links through `scopedHref`. It never learns the
// ladder, and it cannot drop an axis the destination needed.
// =============================================================================

import type { WorldUniverseNode } from "@/lib/db/queries";
import { DEFAULT_BOOK_ID, DEFAULT_UNIVERSE_ID } from "@/lib/db/scope";

/** The resolved universe -> world -> book the writer is currently working in. */
export interface ActiveScope {
  universeId: string;
  worldId: string;
  bookId: string;
}

/** The scope axes as they appear in a URL. */
export interface ScopeParams {
  u?: string;
  w?: string;
  book?: string;
}

const PARAM_OF: Record<keyof ActiveScope, string> = {
  universeId: "u",
  worldId: "w",
  bookId: "book",
};

/**
 * Which axes each surface can actually use. /write is the only surface that
 * selects a book; the rest resolve one internally from the active world, so
 * handing them a book id would be noise at best and a wrong re-scope at worst.
 */
const AXES_BY_SURFACE: ReadonlyArray<readonly [string, readonly (keyof ActiveScope)[]]> = [
  ["/write", ["universeId", "worldId", "bookId"]],
  ["/wiki", ["universeId", "worldId"]],
  ["/research", ["universeId", "worldId"]],
  ["/plot", ["universeId", "worldId"]],
];

/** The world identity every surface shares, for a path not in the table. */
const SHARED_AXES: readonly (keyof ActiveScope)[] = ["universeId", "worldId"];

function axesFor(path: string): readonly (keyof ActiveScope)[] {
  return AXES_BY_SURFACE.find(([prefix]) => path.startsWith(prefix))?.[1] ?? SHARED_AXES;
}

/**
 * Resolve the active scope from the URL, validated against the world tree so a
 * stale or foreign id falls back rather than rendering an empty or wrong page.
 * See the file header for the full ladder.
 *
 * `book` is optional: a surface that does not select a book simply omits it and
 * gets the active world's first book — the same value /write would resolve for
 * an absent `?book=`, so the two can never disagree about which book a world's
 * content belongs to.
 */
export function resolveActiveScope(
  tree: WorldUniverseNode[],
  params: ScopeParams,
): ActiveScope {
  const universe =
    tree.find((x) => x.id === params.u) ??
    tree.find((x) => x.id === DEFAULT_UNIVERSE_ID) ??
    tree[0];
  const universeId = universe?.id ?? DEFAULT_UNIVERSE_ID;

  // Only worlds of the ACTIVE universe are selectable, so a `?w=` from a sibling
  // universe can never cross-scope. When the universe has no worlds row at all
  // (pre-backfill), the legacy 1:1 id keeps the page renderable.
  const worlds = universe?.worlds ?? [];
  const world = worlds.find((w) => w.id === params.w) ?? worlds[0];
  const worldId = world?.id ?? `world-${universeId}`;

  // Likewise for books: only the ACTIVE world's books are selectable.
  const books = world?.books ?? [];
  const bookId = books.find((b) => b.id === params.book)?.id ?? books[0]?.id ?? DEFAULT_BOOK_ID;

  return { universeId, worldId, bookId };
}

/**
 * A link to `path` that keeps the active scope.
 *
 * Axes the destination cannot use are dropped; axes it needs are carried. An
 * axis left undefined in `scope` is simply omitted, which is how a caller says
 * "let the destination resolve this one" (picking a universe without naming a
 * world lands on that universe's first world). `extra` carries surface-specific
 * params — `chapter` on /write, `thread` on /research — which are never scope.
 *
 * With nothing to carry the bare path is returned, so a target with no active
 * scope resolves its own default.
 */
export function scopedHref(
  path: string,
  scope: Partial<ActiveScope>,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  for (const axis of axesFor(path)) {
    const value = scope[axis];
    if (value) params.set(PARAM_OF[axis], value);
  }
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
