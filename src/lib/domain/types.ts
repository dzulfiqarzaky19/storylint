// Framework-free domain types: one TS type per table row + composed WikiSnapshot.
// Row types mirror the snake_case DB columns mapped to camelCase in the query layer.

export type Kind = "character" | "world" | "organization" | "lore";
export type Shelf = "people" | "places" | "orders" | "lore";
/**
 * The wiki context a research thread is scoped to. 'chat' = broad, no wiki
 * context; a Kind = the AI sees ALL entries of that kind (F4-P2).
 */
export type ResearchScope = "chat" | Kind;
export type Flag = "red" | "yellow";
export type TurnSide = "them" | "you";

// ---- Kind / shelf metadata (HANDOFF §6) -----------------------------------

export const KIND_LABEL: Record<Kind, string> = {
  character: "Person",
  world: "Place",
  organization: "Order",
  lore: "Lore",
};

export const KIND_SHELF: Record<Kind, Shelf> = {
  character: "people",
  world: "places",
  organization: "orders",
  lore: "lore",
};

/** Inverse of KIND_SHELF: the Kind a new manually-created entry gets on a shelf. */
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

// ---- Row types ------------------------------------------------------------

export interface EntryRow {
  id: string;
  kind: Kind;
  name: string;
  catalogueNo: string;
  note: string;
  summary: string;
  shelf: Shelf;
  sortOrder: number;
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

export interface ChapterAppearanceRow {
  id: string;
  entryId: string;
  chapter: number;
  text: string;
  flag: Flag | null;
  flagText: string | null;
  sortOrder: number;
}

export interface OpenQuestionRow {
  id: string;
  entryId: string;
  text: string;
  sortOrder: number;
}

export interface ChapterRow {
  id: string;
  number: number;
  title: string;
  body: unknown; // ProseMirror JSON document
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

export interface KeptCardRow {
  propositionId: string;
  keptAt: number;
  inWiki: boolean;
}

export interface ResolvedMarkRow {
  markKey: string;
  resolution: string;
  resolvedAt: number;
}

export interface DismissedSuggestionRow {
  suggestionKey: string;
}

// ---- Composed / view types ------------------------------------------------

/** A tie with the resolved target entry's display fields, for rendering the Ties block. */
export interface ResolvedTie extends TieRow {
  toName: string;
  toKind: Kind;
  toCatalogueNo: string;
}

/** An entry with everything the Wiki screen needs to render it. */
export interface EntryWithDetails extends EntryRow {
  facts: FactRow[];
  ties: ResolvedTie[];
  appearances: ChapterAppearanceRow[];
  openQuestions: OpenQuestionRow[];
}

/**
 * The read-only projection the check engine consumes (HANDOFF §7).
 * Pure data: entries with their facts, ties, appearances, open questions.
 */
export interface WikiSnapshot {
  entries: EntryWithDetails[];
  byId: Record<string, EntryWithDetails>;
}

// ---- Research view types --------------------------------------------------

export interface ResearchProposition extends PropositionRow {
  kept: boolean;
  inWiki: boolean;
}

export interface ResearchTurnWithCards extends ResearchTurnRow {
  cards: ResearchProposition[];
}

// ---- Research threads (Track B — multi-thread sidebar) --------------------
// APPEND-ONLY: added for the Gemini-style Research thread list. Mirrors the
// research_threads table (schema.sql). Do not fold into existing types.

export interface ResearchThreadRow {
  id: string;
  title: string;
  subtitle: string;
  sortOrder: number;
}
