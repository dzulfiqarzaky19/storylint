// Wiki store — state shape + action union. The reducer (index.ts) and the pure
// per-aggregate transition helpers (entries/facts/ties/categories) all import
// these types. Split out of the former monolithic wikiStore.ts (T-ARCH-15).
import type {
  CategoryLabelOverrides,
  CategoryRow,
  EntryWithDetails,
  Kind,
  Shelf,
} from "../../domain/types";

// ---- State ----------------------------------------------------------------

/** A poster-band suggestion projected from the check engine's `missing` marks. */
export interface WikiSuggestion {
  suggestionKey: string;
  entryId: string;
  key: string;
  value: string;
  text: string;
  source: string;
}

export interface WikiState {
  /** All entries, keyed for O(1) lookup and mutation. */
  byId: Record<string, EntryWithDetails>;
  /** Ordered entry ids per shelf — the draggable arrangement. */
  order: Record<Shelf, string[]>;
  /** The focused entry shown in the entry band, or null. */
  selectedEntryId: string | null;
  /** Live poster-band suggestions (dismissed ones removed). */
  suggestions: WikiSuggestion[];
  /** Per-kind category-header label overrides (F6-S5). Empty when none set. */
  overrides: CategoryLabelOverrides;
  /**
   * F9-B (S2): the FULL live category list (built-ins + user categories), kept
   * sorted by sortOrder. Additive to `overrides` (the legacy renamed-built-in
   * shape). CREATE_CATEGORY appends here; RENAME/DELETE_CATEGORY keep it in sync
   * with the matching row so user categories can later render (S3 UI).
   */
  categories: CategoryRow[];
  /** In-flight/last error from a paired server action, surfaced not swallowed. */
  error: string | null;
}

// ---- Actions --------------------------------------------------------------
//
// action type              →  matching Server Action (actions/wiki.ts)
// SELECT_ENTRY             →  selectEntry
// MOVE_ENTRY               →  moveEntry(toShelf, beforeId)
// LINK_ENTRY               →  linkEntry
// MOVE_FACT                →  moveFact(toEntryId)
// ADD_SUGGESTION_AS_FACT   →  addSuggestionAsFact   (WIKI WRITE, confirmed)
// DISMISS_SUGGESTION       →  dismissSuggestion
// SET_ERROR                →  (none — surfaces a failed server action)

export type WikiAction =
  | { type: "SELECT_ENTRY"; entryId: string | null }
  | { type: "MOVE_ENTRY"; entryId: string; toShelf: Shelf; beforeId: string | null }
  | {
      type: "LINK_ENTRY";
      /** Server-generated tie id (reducer is pure; caller supplies it). */
      tieId: string;
      fromEntryId: string;
      toEntryId: string;
      rel: string;
    }
  | { type: "MOVE_FACT"; factId: string; fromEntryId: string; toEntryId: string }
  | {
      type: "ADD_SUGGESTION_AS_FACT";
      suggestionKey: string;
      entryId: string;
      /** Server-generated fact id (reducer is pure; caller supplies it). */
      factId: string;
      key: string;
      value: string;
      sortOrder: number;
    }
  | { type: "DISMISS_SUGGESTION"; suggestionKey: string }
  | { type: "SET_ERROR"; error: string | null }
  // ---- Manual authoring (Track A) — fired alongside actions/wiki.ts ----
  // EDIT_ENTRY_FIELDS  → editEntry   (WIKI WRITE, inherently confirmed)
  // EDIT_FACT          → editFact    (WIKI WRITE, inherently confirmed)
  // CREATE_ENTRY       → createEntry (WIKI WRITE, inherently confirmed)
  // CREATE_FACT        → createFact  (WIKI WRITE, inherently confirmed)
  // DELETE_FACT        → deleteFact  (WIKI WRITE, inherently confirmed)
  | {
      type: "EDIT_ENTRY_FIELDS";
      entryId: string;
      name?: string;
      note?: string;
      summary?: string;
      catalogueNo?: string;
    }
  | {
      type: "EDIT_FACT";
      entryId: string;
      factId: string;
      key?: string;
      value?: string;
    }
  | {
      type: "CREATE_ENTRY";
      /** Server-generated entry id (reducer is pure; caller supplies it). */
      entryId: string;
      kind: string;
      shelf: Shelf;
      name: string;
      note: string;
      summary: string;
      sortOrder: number;
    }
  | {
      type: "CREATE_FACT";
      entryId: string;
      /** Server-generated fact id (reducer is pure; caller supplies it). */
      factId: string;
      key: string;
      value: string;
      sortOrder: number;
    }
  | {
      type: "DELETE_FACT";
      /** The entry the fact belongs to. */
      entryId: string;
      /** The fact to remove. Hard removal — delete is intentional, no tombstone. */
      factId: string;
    }
  | {
      type: "SOFT_DELETE_ENTRY";
      /** The entry being soft-deleted. Removed from byId + its shelf order so
       *  it vanishes from the index; ties from OTHER entries that still point at
       *  it now resolve as dangling "removed" tombstones. */
      entryId: string;
    }
  // ---- Ties (F6-S4b) — fired alongside actions/wiki.ts untie/createEntryTied ----
  | {
      type: "UNTIE";
      /** The entry the tie hangs off (its `ties[]` loses exactly `tieId`). */
      fromEntryId: string;
      /** The tie to remove. Hard removal — untie is intentional, no tombstone. */
      tieId: string;
    }
  | {
      type: "CREATE_TIED";
      /** Server-generated ids (reducer is pure; caller supplies them). */
      entryId: string;
      tieId: string;
      /** The new person. */
      kind: Kind;
      shelf: Shelf;
      name: string;
      /** The existing entry the new person is tied FROM (owns the tie row). */
      toEntryId: string;
      /** User-set relationship label carried into the tie (e.g. "uncle"). */
      rel: string;
    }
  // ---- Categories (F6-S5b) — fired alongside actions renameCategory /
  //      resetCategoryLabel / deleteCategory ----
  // RENAME_CATEGORY  → renameCategory     (label table write; trims, blank=reset)
  // RESET_CATEGORY   → resetCategoryLabel  (label table delete)
  // DELETE_CATEGORY  → deleteCategory      (WIKI WRITE, confirmed: bulk soft-delete)
  // CREATE_CATEGORY  → createCategory      (F9-B S1: new category row)
  | {
      type: "CREATE_CATEGORY";
      /** The server-created category row (reducer is pure; caller supplies it). */
      category: CategoryRow;
    }
  | { type: "RENAME_CATEGORY"; kind: string; label: string }
  | { type: "RESET_CATEGORY"; kind: string }
  | {
      type: "DELETE_CATEGORY";
      /** Every LIVE entry of this kind is soft-deleted (vanishes from byId +
       *  its shelf order); ties from surviving entries render as tombstones. */
      kind: string;
    }
  // ---- Trash: restore (F6-S6) — fired alongside actions/wiki.ts restoreEntry ----
  // RESTORE_ENTRY  → restoreEntry (WIKI WRITE, confirmed: re-enters a tombstone)
  | {
      type: "RESTORE_ENTRY";
      /** The now-live entry WITH its details (the server reloaded it after
       *  clearing deleted_at). Re-added to byId + appended to its shelf order —
       *  the pure inverse of SOFT_DELETE_ENTRY. Ties from OTHER entries that
       *  pointed at it stop rendering as tombstones once it is back in byId. */
      entry: EntryWithDetails;
    };
