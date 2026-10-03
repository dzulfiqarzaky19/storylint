import type { WorldUniverseNode } from "@/domain/structure";

export interface SwitcherItem {
  universeId: string;
  universeName: string;
  worldId: string;
  worldTitle: string;
  active: boolean;
}

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
