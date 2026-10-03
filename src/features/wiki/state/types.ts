import type {
  CategoryLabelOverrides,
  CategoryRow,
  EntryWithDetails,
  Kind,
  Shelf,
  WikiSuggestion,
} from "@/domain/types";

export interface WikiState {
  byId: Record<string, EntryWithDetails>;
  order: Record<Shelf, string[]>;
  selectedEntryId: string | null;
  suggestions: WikiSuggestion[];
  overrides: CategoryLabelOverrides;
  categories: CategoryRow[];
  error: string | null;
}

export type WikiAction =
  | { type: "SELECT_ENTRY"; entryId: string | null }
  | { type: "MOVE_ENTRY"; entryId: string; toShelf: Shelf; beforeId: string | null }
  | {
      type: "LINK_ENTRY";
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
      factId: string;
      key: string;
      value: string;
      sortOrder: number;
    }
  | { type: "DISMISS_SUGGESTION"; suggestionKey: string }
  | { type: "SET_ERROR"; error: string | null }
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
      factId: string;
      key: string;
      value: string;
      sortOrder: number;
    }
  | {
      type: "DELETE_FACT";
      entryId: string;
      factId: string;
    }
  | {
      type: "SOFT_DELETE_ENTRY";
      entryId: string;
    }
  | {
      type: "UNTIE";
      fromEntryId: string;
      tieId: string;
    }
  | {
      type: "CREATE_TIED";
      entryId: string;
      tieId: string;
      kind: Kind;
      shelf: Shelf;
      name: string;
      toEntryId: string;
      rel: string;
    }
  | {
      type: "CREATE_CATEGORY";
      category: CategoryRow;
    }
  | { type: "RENAME_CATEGORY"; kind: string; label: string }
  | { type: "RESET_CATEGORY"; kind: string }
  | {
      type: "DELETE_CATEGORY";
      kind: string;
    }
  | {
      type: "RESTORE_ENTRY";
      entry: EntryWithDetails;
    };
