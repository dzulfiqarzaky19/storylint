export type Kind = "character" | "world" | "organization" | "lore";
export type Shelf = "people" | "places" | "orders" | "lore";
export type ResearchScope = "chat" | Kind;
export type TurnSide = "them" | "you";

export const KIND_LABEL: Record<Kind, string> = {
  character: "Person",
  world: "Place",
  organization: "Order",
  lore: "Lore",
};

export function kindLabelOf(kind: string): string {
  return (KIND_LABEL as Record<string, string>)[kind] ?? kind;
}

export const KIND_SHELF: Record<Kind, Shelf> = {
  character: "people",
  world: "places",
  organization: "orders",
  lore: "lore",
};

export const KIND_FOR_SHELF: Record<Shelf, Kind> = {
  people: "character",
  places: "world",
  orders: "organization",
  lore: "lore",
};

export const SHELF_TITLES: Record<Shelf, string> = {
  people: "People",
  places: "Places",
  orders: "Orders",
  lore: "Lore",
};

export interface CategoryRow {
  id: string;
  label: string;
  shelf: string;
  sortOrder: number;
  isBuiltin: boolean;
  deletedAt: number | null;
}

export interface EntryRow {
  id: string;
  kind: string;
  name: string;
  catalogueNo: string;
  note: string;
  summary: string;
  shelf: Shelf;
  sortOrder: number;
  deletedAt: number | null;
}

export interface FactRow {
  id: string;
  entryId: string;
  key: string;
  value: string;
  fresh: boolean;
  sortOrder: number;
}

export interface TieRow {
  id: string;
  fromEntryId: string;
  toEntryId: string;
  rel: string;
}

export interface ChapterRow {
  id: string;
  number: number;
  title: string;
  body: unknown;
}

export interface ChapterCheckCacheRow {
  chapterId: string;
  bodyHash: string;
  wikiHash: string;
  marks: unknown;
  checkedAt: number;
}

export interface ResearchTurnRow {
  id: string;
  threadId: string;
  ordinal: number;
  side: TurnSide;
  who: string;
  text: string;
}

export interface PropositionRow {
  id: string;
  turnId: string;
  kind: string;
  title: string;
  body: string;
  asKind: string;
  sortOrder: number;
}

export interface WorldKeptCardRow {
  propositionId: string;
  kind: string;
  title: string;
  body: string;
  inWiki: boolean;
  threadId: string;
  threadTitle: string;
}

export interface ResolvedMarkRow {
  markKey: string;
  resolution: string;
  resolvedAt: number;
}

export interface ResolvedTie extends TieRow {
  toName: string;
  toKind: string;
  toCatalogueNo: string;
}

export interface EntryWithDetails extends EntryRow {
  facts: FactRow[];
  ties: ResolvedTie[];
}

export type CategoryLabelOverrides = Partial<Record<Kind, string>>;

export interface WikiSnapshot {
  entries: EntryWithDetails[];
  byId: Record<string, EntryWithDetails>;
  overrides: CategoryLabelOverrides;
  categories: CategoryRow[];
}

export interface ResearchProposition extends PropositionRow {
  kept: boolean;
  inWiki: boolean;
  forEntry?: string;
}

export interface ResearchTurnWithCards extends ResearchTurnRow {
  cards: ResearchProposition[];
}

export interface ResearchThreadRow {
  id: string;
  title: string;
  subtitle: string;
  sortOrder: number;
  scope: ResearchScope;
  worldId: string;
}

export interface ResearchSnapshot {
  question: string;
  threadId: string;
  turns: ResearchTurnWithCards[];
  initialVisibleTurnIds: string[];
  threads: ResearchThreadRow[];
}

export interface WikiSuggestion {
  suggestionKey: string;
  entryId: string;
  key: string;
  value: string;
  text: string;
  source: string;
}
