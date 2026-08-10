// =============================================================================
// Wiki store (HANDOFF §8) — useReducer state shape + action union + pure reducer.
//
// The reducer is the SESSION source of truth so drag feedback is instant. Each
// reducer action is fired ALONGSIDE its matching Server Action (src/lib/actions/
// wiki.ts); the mapping is documented per-action below. The reducer is PURE:
// no I/O, no Date.now, no random — callers pass any needed ids/timestamps in.
//
// This is a contract scaffold: shapes + a reducer skeleton for Phase 4 to build
// the Wiki screen against. Rendering/DnD wiring is out of scope here.
// =============================================================================

import type {
  CategoryLabelOverrides,
  EntryWithDetails,
  FactRow,
  Kind,
  ResolvedTie,
  Shelf,
  WikiSnapshot,
} from "../domain/types";
import { applyCategoryRename, applyCategoryReset } from "../wiki/categoryLabels";

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
      kind: Kind;
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
  | { type: "RENAME_CATEGORY"; kind: Kind; label: string }
  | { type: "RESET_CATEGORY"; kind: Kind }
  | {
      type: "DELETE_CATEGORY";
      /** Every LIVE entry of this kind is soft-deleted (vanishes from byId +
       *  its shelf order); ties from surviving entries render as tombstones. */
      kind: Kind;
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

// ---- Init -----------------------------------------------------------------

/** Build initial state from a server-loaded snapshot. */
export function initWikiState(snapshot: WikiSnapshot, suggestions: WikiSuggestion[] = []): WikiState {
  const order: Record<Shelf, string[]> = { people: [], places: [], orders: [], lore: [] };
  for (const entry of snapshot.entries) {
    const bucket = order[entry.shelf];
    if (!bucket) {
      // Corrupt/legacy data: an entry whose shelf is outside the valid set
      // would crash the index build (order[bad].push -> 500). Skip it and warn
      // rather than throw; valid entries are unaffected.
      console.warn(`[initWikiState] entry ${entry.id} has unknown shelf ${entry.shelf}, skipped`);
      continue;
    }
    bucket.push(entry.id);
  }
  return {
    byId: { ...snapshot.byId },
    order,
    selectedEntryId: snapshot.entries[0]?.id ?? null,
    suggestions,
    overrides: { ...snapshot.overrides },
    error: null,
  };
}

// ---- Reducer (pure) -------------------------------------------------------

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

    case "SOFT_DELETE_ENTRY":
      return softDeleteEntryInState(state, action.entryId);

    case "UNTIE":
      return untieInState(state, action.fromEntryId, action.tieId);

    case "CREATE_TIED":
      return createTiedInState(state, action);

    case "RENAME_CATEGORY":
      return { ...state, overrides: applyCategoryRename(state.overrides, action.kind, action.label) };

    case "RESET_CATEGORY":
      return { ...state, overrides: applyCategoryReset(state.overrides, action.kind) };

    case "DELETE_CATEGORY":
      return deleteCategoryInState(state, action.kind);

    case "RESTORE_ENTRY":
      return restoreEntryInState(state, action.entry);

    default:
      return assertNever(action);
  }
}

// ---- Helpers --------------------------------------------------------------

/** Move an entry to a shelf, positioned before `beforeId` (or appended). Pure. */
function moveEntryInState(
  state: WikiState,
  entryId: string,
  toShelf: Shelf,
  beforeId: string | null,
): WikiState {
  const order: Record<Shelf, string[]> = {
    people: state.order.people.filter((id) => id !== entryId),
    places: state.order.places.filter((id) => id !== entryId),
    orders: state.order.orders.filter((id) => id !== entryId),
    lore: state.order.lore.filter((id) => id !== entryId),
  };
  const dest = order[toShelf];
  const at = beforeId ? dest.indexOf(beforeId) : -1;
  if (at >= 0) dest.splice(at, 0, entryId);
  else dest.push(entryId);

  const existing = state.byId[entryId];
  const byId = existing
    ? { ...state.byId, [entryId]: { ...existing, shelf: toShelf } }
    : state.byId;

  return { ...state, order, byId };
}

/** Append a directional tie to the source entry (pure). Target display fields
 *  come from the destination entry already in state. */
function linkEntryInState(
  state: WikiState,
  action: { tieId: string; fromEntryId: string; toEntryId: string; rel: string },
): WikiState {
  const from = state.byId[action.fromEntryId];
  const to = state.byId[action.toEntryId];
  if (!from || !to) return state;
  // Idempotent: don't duplicate an identical tie.
  if (from.ties.some((t) => t.toEntryId === action.toEntryId && t.rel === action.rel)) {
    return state;
  }
  const tie: ResolvedTie = {
    id: action.tieId,
    fromEntryId: action.fromEntryId,
    toEntryId: action.toEntryId,
    rel: action.rel,
    toName: to.name,
    toKind: to.kind as Kind,
    toCatalogueNo: to.catalogueNo,
  };
  return {
    ...state,
    byId: { ...state.byId, [from.id]: { ...from, ties: [...from.ties, tie] } },
  };
}

/** Move a fact row from one entry to another (pure). */
function moveFactInState(
  state: WikiState,
  factId: string,
  fromEntryId: string,
  toEntryId: string,
): WikiState {
  if (fromEntryId === toEntryId) return state;
  const from = state.byId[fromEntryId];
  const to = state.byId[toEntryId];
  if (!from || !to) return state;
  const fact = from.facts.find((f) => f.id === factId);
  if (!fact) return state;
  const moved: FactRow = {
    ...fact,
    entryId: toEntryId,
    sortOrder: to.facts.length,
  };
  return {
    ...state,
    byId: {
      ...state.byId,
      [fromEntryId]: { ...from, facts: from.facts.filter((f) => f.id !== factId) },
      [toEntryId]: { ...to, facts: [...to.facts, moved] },
    },
  };
}

/** Append a fresh fact to an entry and drop the consumed suggestion (pure). */
function addSuggestionAsFactInState(
  state: WikiState,
  action: {
    suggestionKey: string;
    entryId: string;
    factId: string;
    key: string;
    value: string;
    sortOrder: number;
  },
): WikiState {
  const entry = state.byId[action.entryId];
  const suggestions = state.suggestions.filter(
    (s) => s.suggestionKey !== action.suggestionKey,
  );
  if (!entry) return { ...state, suggestions };
  const fact: FactRow = {
    id: action.factId,
    entryId: action.entryId,
    key: action.key,
    value: action.value,
    fresh: true,
    sortOrder: action.sortOrder,
  };
  return {
    ...state,
    suggestions,
    byId: {
      ...state.byId,
      [action.entryId]: { ...entry, facts: [...entry.facts, fact] },
    },
  };
}

// ---- Manual authoring helpers (Track A) -----------------------------------

/** Patch a subset of an entry's scalar fields (pure). No-op if entry unknown. */
function editEntryFieldsInState(
  state: WikiState,
  action: {
    entryId: string;
    name?: string;
    note?: string;
    summary?: string;
    catalogueNo?: string;
  },
): WikiState {
  const entry = state.byId[action.entryId];
  if (!entry) return state;
  const next: EntryWithDetails = { ...entry };
  if (action.name !== undefined) next.name = action.name;
  if (action.note !== undefined) next.note = action.note;
  if (action.summary !== undefined) next.summary = action.summary;
  if (action.catalogueNo !== undefined) next.catalogueNo = action.catalogueNo;
  return { ...state, byId: { ...state.byId, [action.entryId]: next } };
}

/** Patch a subset of a fact's fields (pure). No-op if entry/fact unknown. */
function editFactInState(
  state: WikiState,
  action: { entryId: string; factId: string; key?: string; value?: string },
): WikiState {
  const entry = state.byId[action.entryId];
  if (!entry) return state;
  let changed = false;
  const facts = entry.facts.map((f) => {
    if (f.id !== action.factId) return f;
    changed = true;
    return {
      ...f,
      key: action.key !== undefined ? action.key : f.key,
      value: action.value !== undefined ? action.value : f.value,
    };
  });
  if (!changed) return state;
  return { ...state, byId: { ...state.byId, [action.entryId]: { ...entry, facts } } };
}

/** Insert a blank draft entry on its shelf, append to shelf order, select it. */
function createEntryInState(
  state: WikiState,
  action: {
    entryId: string;
    kind: Kind;
    shelf: Shelf;
    name: string;
    note: string;
    summary: string;
    sortOrder: number;
  },
): WikiState {
  const entry: EntryWithDetails = {
    id: action.entryId,
    kind: action.kind,
    name: action.name,
    catalogueNo: "—",
    note: action.note,
    summary: action.summary,
    shelf: action.shelf,
    sortOrder: action.sortOrder,
    deletedAt: null,
    facts: [],
    ties: [],
    appearances: [],
    openQuestions: [],
  };
  const order: Record<Shelf, string[]> = {
    people: [...state.order.people],
    places: [...state.order.places],
    orders: [...state.order.orders],
    lore: [...state.order.lore],
  };
  order[action.shelf] = [...order[action.shelf], action.entryId];
  return {
    ...state,
    byId: { ...state.byId, [action.entryId]: entry },
    order,
    selectedEntryId: action.entryId,
  };
}

/**
 * Remove an entry from the live session: drop it from byId and from its shelf
 * order so it vanishes from the index, and deselect it if it was focused. The
 * DB keeps the row (soft delete) so ties from OTHER entries that still point at
 * it render as dangling "removed" tombstones. No-op if the entry is unknown.
 */
function softDeleteEntryInState(state: WikiState, entryId: string): WikiState {
  const entry = state.byId[entryId];
  if (!entry) return state;
  const byId = { ...state.byId };
  delete byId[entryId];
  const order: Record<Shelf, string[]> = {
    people: [...state.order.people],
    places: [...state.order.places],
    orders: [...state.order.orders],
    lore: [...state.order.lore],
  };
  order[entry.shelf] = order[entry.shelf].filter((id) => id !== entryId);
  return {
    ...state,
    byId,
    order,
    selectedEntryId: state.selectedEntryId === entryId ? null : state.selectedEntryId,
  };
}

/**
 * Restore a soft-deleted entry into session state (pure) — the exact inverse of
 * softDeleteEntryInState. Re-add the (server-reloaded, fully-detailed) entry to
 * byId and append its id to its shelf order so it reappears on the shelf. Ties
 * from OTHER entries that had rendered it as a "removed" tombstone resolve live
 * again the moment it is back in byId (tie tombstoning is membership-derived).
 *
 * Idempotent: if the id is somehow already present in the shelf order (double
 * dispatch), it is not appended twice. byId is overwritten with the fresh row
 * either way.
 */
function restoreEntryInState(state: WikiState, entry: EntryWithDetails): WikiState {
  const byId = { ...state.byId, [entry.id]: entry };
  const order: Record<Shelf, string[]> = {
    people: [...state.order.people],
    places: [...state.order.places],
    orders: [...state.order.orders],
    lore: [...state.order.lore],
  };
  if (!order[entry.shelf].includes(entry.id)) {
    order[entry.shelf] = [...order[entry.shelf], entry.id];
  }
  return { ...state, byId, order };
}

/**
 * Soft-delete EVERY live entry of a category `kind` in one transition (pure) —
 * the session mirror of deleteCategory's bulk soft-delete. Fans the existing
 * softDeleteEntryInState over exactly the byId entries whose `kind` matches, so
 * each vanishes from byId + its shelf order and ties from surviving entries
 * resolve as "removed" tombstones (identical to a single soft delete). Because
 * session byId holds only LIVE entries, a re-dispatch on an already-emptied kind
 * is a no-op: nothing of that kind remains to remove. No-op if the kind is empty.
 */
function deleteCategoryInState(state: WikiState, kind: Kind): WikiState {
  const ids = Object.values(state.byId)
    .filter((e) => e.kind === kind)
    .map((e) => e.id);
  return ids.reduce((acc, id) => softDeleteEntryInState(acc, id), state);
}

/**
 * Remove exactly ONE tie from an entry's `ties[]` (pure). Untie is an
 * intentional removal, so the tie is dropped outright — no tombstone (that is
 * reserved for a soft-deleted TARGET, whose inbound ties survive as dangling
 * badges). Removes only the addressed `tieId`, leaving every other tie on the
 * entry intact. No-op if the entry is unknown or holds no such tie.
 */
function untieInState(state: WikiState, fromEntryId: string, tieId: string): WikiState {
  const entry = state.byId[fromEntryId];
  if (!entry) return state;
  const ties = entry.ties.filter((t) => t.id !== tieId);
  if (ties.length === entry.ties.length) return state; // no matching tie: no-op
  return {
    ...state,
    byId: { ...state.byId, [fromEntryId]: { ...entry, ties } },
  };
}

/**
 * Add a NEW person AND tie them to an existing entry in one transition (pure) —
 * the session mirror of createEntryWithTie. Composes the two existing pure
 * helpers so the shelf/order/select behavior and the idempotent-append tie
 * behavior stay identical to CREATE_ENTRY and LINK_ENTRY. The tie carries the
 * user-set `rel`. No-op on the tie half if the anchor (`toEntryId`) is unknown,
 * but the new entry is still created (matches createEntryInState always winning).
 */
function createTiedInState(
  state: WikiState,
  action: {
    entryId: string;
    tieId: string;
    kind: Kind;
    shelf: Shelf;
    name: string;
    toEntryId: string;
    rel: string;
  },
): WikiState {
  const withEntry = createEntryInState(state, {
    entryId: action.entryId,
    kind: action.kind,
    shelf: action.shelf,
    name: action.name,
    note: "",
    summary: "",
    sortOrder: 0,
  });
  return linkEntryInState(withEntry, {
    tieId: action.tieId,
    fromEntryId: action.toEntryId,
    toEntryId: action.entryId,
    rel: action.rel,
  });
}

/** Append a new manual fact to an entry (pure). No-op if entry unknown. */
function createFactInState(
  state: WikiState,
  action: {
    entryId: string;
    factId: string;
    key: string;
    value: string;
    sortOrder: number;
  },
): WikiState {
  const entry = state.byId[action.entryId];
  if (!entry) return state;
  const fact: FactRow = {
    id: action.factId,
    entryId: action.entryId,
    key: action.key,
    value: action.value,
    fresh: true,
    sortOrder: action.sortOrder,
  };
  return {
    ...state,
    byId: { ...state.byId, [action.entryId]: { ...entry, facts: [...entry.facts, fact] } },
  };
}

function assertNever(x: never): never {
  throw new Error(`wikiReducer: unhandled action ${JSON.stringify(x)}`);
}
