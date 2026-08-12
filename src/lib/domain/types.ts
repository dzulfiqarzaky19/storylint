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

/**
 * Resolve a built-in kind label from an open category-id string. F9-B relaxed
 * `entry.kind` to `string` (a category id); the built-in KIND_LABEL map is now a
 * seed/fallback only. Returns the built-in label when `kind` is one of the four
 * legacy built-ins, else the raw id (a user category has no built-in label; S1
 * UI has no live category-label wiring yet, so the id is the safe fallback).
 */
export function kindLabelOf(kind: string): string {
  return (KIND_LABEL as Record<string, string>)[kind] ?? kind;
}

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

// ---- Categories (F9-B) ----------------------------------------------------

/**
 * A category row (F9-B). Categories are user-extensible data rows that replaced
 * the fixed `Kind` enum + the `category_labels` override table. The 4 built-ins
 * have `id` EQUAL to the historic enum strings ('character'/'world'/
 * 'organization'/'lore') and `isBuiltin = true`; user categories get a generated
 * id. `label` is the single source for the shelf/category header text. `shelf`
 * groups the category under a shelf. `deletedAt` soft-deletes a user category
 * (NULL = live). Mirrors the `categories` table (schema.sql).
 */
export interface CategoryRow {
  id: string;
  label: string;
  shelf: string;
  sortOrder: number;
  isBuiltin: boolean;
  /** Soft-delete marker (epoch millis). null = live; non-null = deleted. */
  deletedAt: number | null;
}

// ---- Row types ------------------------------------------------------------

export interface EntryRow {
  id: string;
  /**
   * F9-B: a category id (soft FK to categories.id). Relaxed from the closed
   * `Kind` union to `string` at the DB boundary because categories are now
   * user-extensible data rows, not a fixed enum. The 4 built-in ids still equal
   * the old enum strings, so built-in lookups (KIND_LABEL/KIND_SHELF) keep
   * working; a user category id simply has no built-in record-map entry.
   */
  kind: string;
  name: string;
  catalogueNo: string;
  note: string;
  summary: string;
  shelf: Shelf;
  sortOrder: number;
  /** Soft-delete marker (epoch millis). null = live; non-null = deleted (F6). */
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
  /** F9-B: a category id (soft FK to categories.id), relaxed from `Kind`. */
  toKind: string;
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
 * Per-kind category-header display-name overrides (from the `category_labels`
 * table, F6-S5). A kind absent from the map has no custom label and falls back
 * to its shelf default. Partial on purpose: only renamed categories have a row.
 */
export type CategoryLabelOverrides = Partial<Record<Kind, string>>;

/**
 * The read-only projection the check engine consumes (HANDOFF §7).
 * Pure data: entries with their facts, ties, appearances, open questions.
 */
export interface WikiSnapshot {
  entries: EntryWithDetails[];
  byId: Record<string, EntryWithDetails>;
  /** Per-kind category-header label overrides (F6-S5). Empty when none set. */
  overrides: CategoryLabelOverrides;
  /**
   * F9-B (S2): the FULL live category list (deleted_at IS NULL), sorted by
   * sortOrder — the 4 built-ins plus any user-created categories. Additive to
   * `overrides` (which stays for back-compat): overrides is the legacy renamed-
   * built-in shape; categories is the single source the store now carries so
   * user categories can later render (S3 UI).
   */
  categories: CategoryRow[];
}

// ---- Research view types --------------------------------------------------

export interface ResearchProposition extends PropositionRow {
  kept: boolean;
  inWiki: boolean;
  /**
   * TCK-021: OPTIONAL in-memory routing hint — the exact name of an existing
   * entry the AI says this card is ABOUT, so it enriches that entry (a detail /
   * fact row) instead of minting a new one. NOT persisted (no `propositions`
   * column); it rides the card returned to the client for this turn only. On a
   * reload it is absent and the title-matcher (recommendEnrichTarget) is the
   * fallback, so routing degrades gracefully.
   */
  forEntry?: string;
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
  scope: ResearchScope;
}
