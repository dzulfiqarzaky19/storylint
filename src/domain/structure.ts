export interface WorldBookNode {
  id: string;
  name: string;
  sortOrder: number;
}

export interface WorldNode {
  id: string;
  title: string;
  sortOrder: number;
  books: WorldBookNode[];
}

export interface WorldUniverseNode {
  id: string;
  name: string;
  worlds: WorldNode[];
}
