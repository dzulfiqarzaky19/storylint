/* Pure model for the design-3a breadcrumb switcher menu, extracted from
   ScopePill so the "what does the menu show and what's active?" decision is
   unit-testable in the node env (no React/DOM types leak in). The interactive
   dropdown wiring in ScopePill.tsx is proven by the Firefox / playwright
   drive; the shape below is proven here (same split as scopeHref.ts). */

import type { WorldUniverseNode } from "@/lib/db/queries";

/** One selectable world row in the flattened menu, tagged with its parent
 *  universe so the menu can render universe group headers and a pick knows both
 *  ids (a universe switch is "pick that universe's active world"). */
export interface SwitcherItem {
  universeId: string;
  universeName: string;
  worldId: string;
  worldTitle: string;
  /** True for the currently-active world (the one the breadcrumb reflects). */
  active: boolean;
}

/** Flatten the tree into an ordered list of every world across every universe,
 *  marking the active one. Order follows the tree (universes then their worlds,
 *  both already sorted by getWorldTree), so the menu order is deterministic. */
export function flattenSwitcher(
  tree: WorldUniverseNode[],
  activeUniverseId: string,
  activeWorldId: string,
): SwitcherItem[] {
  const items: SwitcherItem[] = [];
  for (const u of tree) {
    for (const w of u.worlds) {
      items.push({
        universeId: u.id,
        universeName: u.name,
        worldId: w.id,
        worldTitle: w.title,
        active: u.id === activeUniverseId && w.id === activeWorldId,
      });
    }
  }
  return items;
}

/** The breadcrumb label for the active scope: "Universe / World". Falls back to
 *  the first universe/world when the active ids don't resolve (defensive: an
 *  unknown ?u=/?w= shouldn't blank the breadcrumb). Returns null only for an
 *  empty tree. */
export function breadcrumbLabel(
  tree: WorldUniverseNode[],
  activeUniverseId: string,
  activeWorldId: string,
): { universe: string; world: string } | null {
  if (tree.length === 0) return null;
  const universe = tree.find((u) => u.id === activeUniverseId) ?? tree[0];
  if (!universe) return null;
  const world =
    universe.worlds.find((w) => w.id === activeWorldId) ?? universe.worlds[0];
  return {
    universe: universe.name,
    world: world ? world.title : "—",
  };
}
