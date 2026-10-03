import type { CategoryRow, Kind } from "@/domain/types";
import { KIND_SHELF, SHELF_TITLES } from "@/domain/types";
import { applyCategoryRename } from "@/domain/wiki/categoryLabels";
import type { WikiState } from "./types";
import { softDeleteEntryInState } from "./entries";

export function deleteCategoryInState(state: WikiState, kind: string): WikiState {
  const ids = Object.values(state.byId)
    .filter((e) => e.kind === kind)
    .map((e) => e.id);
  const afterEntries = ids.reduce((acc, id) => softDeleteEntryInState(acc, id), state);
  const categories = afterEntries.categories.filter((c) => c.id !== kind);
  return { ...afterEntries, categories };
}

export function createCategoryInState(state: WikiState, category: CategoryRow): WikiState {
  if (state.categories.some((c) => c.id === category.id)) return state;
  const categories = [...state.categories, category].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  return { ...state, categories };
}

export function renameCategoryInState(state: WikiState, kind: string, label: string): WikiState {
  const isBuiltin = kind in KIND_SHELF;
  const overrides = isBuiltin
    ? applyCategoryRename(state.overrides, kind as Kind, label)
    : state.overrides;
  const trimmed = label.trim();
  const categories = state.categories.map((c) => {
    if (c.id !== kind) return c;
    if (trimmed !== "") return { ...c, label: trimmed };
    if (isBuiltin) return { ...c, label: SHELF_TITLES[KIND_SHELF[kind as Kind]] };
    return c;
  });
  return { ...state, overrides, categories };
}
