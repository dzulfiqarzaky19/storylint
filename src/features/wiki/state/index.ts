import type { Kind } from "@/domain/types";
import { KIND_SHELF, SHELF_TITLES } from "@/domain/types";
import { applyCategoryReset } from "@/domain/wiki/categoryLabels";
import type { WikiState, WikiAction } from "./types";
import {
  moveEntryInState,
  editEntryFieldsInState,
  createEntryInState,
  softDeleteEntryInState,
  restoreEntryInState,
} from "./entries";
import {
  moveFactInState,
  addSuggestionAsFactInState,
  editFactInState,
  createFactInState,
  deleteFactInState,
} from "./facts";
import { linkEntryInState, untieInState, createTiedInState } from "./ties";
import {
  deleteCategoryInState,
  createCategoryInState,
  renameCategoryInState,
} from "./categories";

export type { WikiState, WikiAction } from "./types";
export { initWikiState } from "./entries";

export function wikiReducer(state: WikiState, action: WikiAction): WikiState {
  switch (action.type) {
    case "SELECT_ENTRY":
      return { ...state, selectedEntryId: action.entryId };

    case "MOVE_ENTRY":
      return moveEntryInState(state, action.entryId, action.toShelf, action.beforeId);

    case "LINK_ENTRY":
      return linkEntryInState(state, action);

    case "MOVE_FACT":
      return moveFactInState(state, action.factId, action.fromEntryId, action.toEntryId);

    case "ADD_SUGGESTION_AS_FACT":
      return addSuggestionAsFactInState(state, action);

    case "DISMISS_SUGGESTION":
      return {
        ...state,
        suggestions: state.suggestions.filter((s) => s.suggestionKey !== action.suggestionKey),
      };

    case "SET_ERROR":
      return { ...state, error: action.error };

    case "EDIT_ENTRY_FIELDS":
      return editEntryFieldsInState(state, action);

    case "EDIT_FACT":
      return editFactInState(state, action);

    case "CREATE_ENTRY":
      return createEntryInState(state, action);

    case "CREATE_FACT":
      return createFactInState(state, action);

    case "DELETE_FACT":
      return deleteFactInState(state, action.entryId, action.factId);

    case "SOFT_DELETE_ENTRY":
      return softDeleteEntryInState(state, action.entryId);

    case "UNTIE":
      return untieInState(state, action.fromEntryId, action.tieId);

    case "CREATE_TIED":
      return createTiedInState(state, action);

    case "CREATE_CATEGORY":
      return createCategoryInState(state, action.category);

    case "RENAME_CATEGORY":
      return renameCategoryInState(state, action.kind, action.label);

    case "RESET_CATEGORY":
      return action.kind in KIND_SHELF
        ? {
            ...state,
            overrides: applyCategoryReset(state.overrides, action.kind as Kind),
            categories: state.categories.map((c) =>
              c.id === action.kind
                ? { ...c, label: SHELF_TITLES[KIND_SHELF[action.kind as Kind]] }
                : c,
            ),
          }
        : state;

    case "DELETE_CATEGORY":
      return deleteCategoryInState(state, action.kind);

    case "RESTORE_ENTRY":
      return restoreEntryInState(state, action.entry);

    default:
      return assertNever(action);
  }
}

function assertNever(x: never): never {
  throw new Error(`wikiReducer: unhandled action ${JSON.stringify(x)}`);
}
