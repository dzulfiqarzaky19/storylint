import type { Kind, ResolvedTie, Shelf } from "@/domain/types";
import type { WikiState } from "./types";
import { createEntryInState } from "./entries";

export function linkEntryInState(
  state: WikiState,
  action: { tieId: string; fromEntryId: string; toEntryId: string; rel: string },
): WikiState {
  const from = state.byId[action.fromEntryId];
  const to = state.byId[action.toEntryId];
  if (!from || !to) return state;
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

export function untieInState(state: WikiState, fromEntryId: string, tieId: string): WikiState {
  const entry = state.byId[fromEntryId];
  if (!entry) return state;
  const ties = entry.ties.filter((t) => t.id !== tieId);
  if (ties.length === entry.ties.length) return state;
  return {
    ...state,
    byId: { ...state.byId, [fromEntryId]: { ...entry, ties } },
  };
}

export function createTiedInState(
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
