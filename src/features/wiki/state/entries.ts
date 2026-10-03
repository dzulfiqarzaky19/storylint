import type { EntryWithDetails, Shelf, WikiSnapshot, WikiSuggestion } from "@/domain/types";
import type { WikiState } from "./types";

export function initWikiState(snapshot: WikiSnapshot, suggestions: WikiSuggestion[] = []): WikiState {
  const order: Record<Shelf, string[]> = { people: [], places: [], orders: [], lore: [] };
  for (const entry of snapshot.entries) {
    const bucket = order[entry.shelf];
    if (!bucket) {
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
    categories: [...snapshot.categories],
    error: null,
  };
}

export function moveEntryInState(
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

export function editEntryFieldsInState(
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

export function createEntryInState(
  state: WikiState,
  action: {
    entryId: string;
    kind: string;
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

export function softDeleteEntryInState(state: WikiState, entryId: string): WikiState {
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

export function restoreEntryInState(state: WikiState, entry: EntryWithDetails): WikiState {
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
