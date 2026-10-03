import type { WorldUniverseNode } from "@/domain/structure";

export interface ActiveScope {
  universeId: string;
  worldId: string;
  bookId: string;
}

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

const AXES_BY_SURFACE: ReadonlyArray<readonly [string, readonly (keyof ActiveScope)[]]> = [
  ["/write", ["universeId", "worldId", "bookId"]],
  ["/wiki", ["universeId", "worldId"]],
  ["/research", ["universeId", "worldId"]],
  ["/plot", ["universeId", "worldId"]],
];

const SHARED_AXES: readonly (keyof ActiveScope)[] = ["universeId", "worldId"];

function axesFor(path: string): readonly (keyof ActiveScope)[] {
  return AXES_BY_SURFACE.find(([prefix]) => path.startsWith(prefix))?.[1] ?? SHARED_AXES;
}

// Each axis falls back to the first item, so a stale or partial URL still lands
// somewhere real. Ids are "" only when the database has nothing at that level.
export function resolveActiveScope(
  tree: WorldUniverseNode[],
  params: ScopeParams,
): ActiveScope {
  const universe = tree.find((u) => u.id === params.u) ?? tree[0];
  const worlds = universe?.worlds ?? [];
  const world = worlds.find((w) => w.id === params.w) ?? worlds[0];
  const books = world?.books ?? [];
  const book = books.find((b) => b.id === params.book) ?? books[0];

  return {
    universeId: universe?.id ?? "",
    worldId: world?.id ?? "",
    bookId: book?.id ?? "",
  };
}

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
