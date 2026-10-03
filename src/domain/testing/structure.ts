import type { WorldBookNode, WorldNode, WorldUniverseNode } from '../structure';

// Builders for the universe › world › book tree. Imported by test files only.

export function book(id: string, name: string): WorldBookNode {
  return { id, name, sortOrder: 0 };
}

export function world(id: string, title: string, books: WorldBookNode[] = []): WorldNode {
  return { id, title, sortOrder: 0, books };
}

export function universe(id: string, name: string, worlds: WorldNode[] = []): WorldUniverseNode {
  return { id, name, worlds };
}
