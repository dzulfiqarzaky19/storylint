// Pure category transitions. deleteCategoryInState composes the entries base
// (softDeleteEntryInState). Split out of the former monolithic wikiStore.ts
// (T-ARCH-15).
import type { CategoryRow, Kind } from "../../domain/types";
import { KIND_SHELF, SHELF_TITLES } from "../../domain/types";
import { applyCategoryRename } from "../../wiki/categoryLabels";
import type { WikiState } from "./types";
import { softDeleteEntryInState } from "./entries";

/**
 * Soft-delete EVERY live entry of a category `kind` in one transition (pure) —
 * the session mirror of deleteCategory's bulk soft-delete. Fans the existing
 * softDeleteEntryInState over exactly the byId entries whose `kind` matches, so
 * each vanishes from byId + its shelf order and ties from surviving entries
 * resolve as "removed" tombstones (identical to a single soft delete). Because
 * session byId holds only LIVE entries, a re-dispatch on an already-emptied kind
 * is a no-op: nothing of that kind remains to remove. No-op if the kind is empty.
 */
export function deleteCategoryInState(state: WikiState, kind: string): WikiState {
  const ids = Object.values(state.byId)
    .filter((e) => e.kind === kind)
    .map((e) => e.id);
  const afterEntries = ids.reduce((acc, id) => softDeleteEntryInState(acc, id), state);
  // F9-B (S2): also drop the category row from the live list so a deleted
  // category vanishes from the store's category list (S3 UI reads this list),
  // mirroring the DB soft-delete. Matched by id === kind (built-in ids equal
  // the Kind string). No-op for the list if the category id is absent.
  const categories = afterEntries.categories.filter((c) => c.id !== kind);
  return { ...afterEntries, categories };
}

/**
 * F9-B (S2) — session mirror of createCategory. Append the server-created row to
 * the live category list, kept sorted by sortOrder. IDEMPOTENT: a re-dispatch of
 * the same id (double dispatch) does NOT append a duplicate — the existing list
 * is returned unchanged. Pure and non-mutating (new array).
 */
export function createCategoryInState(state: WikiState, category: CategoryRow): WikiState {
  if (state.categories.some((c) => c.id === category.id)) return state;
  const categories = [...state.categories, category].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  return { ...state, categories };
}

/**
 * F9-B (S2/S3) — session mirror of renameCategory generalized onto the category
 * list. Updates BOTH surfaces: the legacy overrides map (built-ins only) AND the
 * matching category row's label. A non-blank rename sets the trimmed label. A
 * blank/whitespace rename RESETS a BUILT-IN to its shelf default; for a USER
 * category (no shelf default) a blank rename is REJECTED (row label kept). A
 * category id absent from the list leaves the list untouched. Pure, non-mutating.
 */
export function renameCategoryInState(state: WikiState, kind: string, label: string): WikiState {
  // Overrides map is keyed by the legacy built-in Kind union, so only a built-in
  // id (one of the 4 Kind strings) touches it; a user category never does.
  const isBuiltin = kind in KIND_SHELF;
  const overrides = isBuiltin
    ? applyCategoryRename(state.overrides, kind as Kind, label)
    : state.overrides;
  const trimmed = label.trim();
  // Blank rename RESETS a BUILT-IN to its shelf default; a USER category has NO
  // shelf default, so a blank rename is REJECTED (keep the row label, never write
  // SHELF_TITLES[undefined]) — F9-B S3 requirement 2.
  const categories = state.categories.map((c) => {
    if (c.id !== kind) return c;
    if (trimmed !== "") return { ...c, label: trimmed };
    if (isBuiltin) return { ...c, label: SHELF_TITLES[KIND_SHELF[kind as Kind]] };
    return c;
  });
  return { ...state, overrides, categories };
}
