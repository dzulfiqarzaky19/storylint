import type { FactRow } from "@/domain/types";
import type { WikiState } from "./types";

export function moveFactInState(
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

export function addSuggestionAsFactInState(
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

export function editFactInState(
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

export function createFactInState(
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

export function deleteFactInState(
  state: WikiState,
  entryId: string,
  factId: string,
): WikiState {
  const entry = state.byId[entryId];
  if (!entry) return state;
  const facts = entry.facts.filter((f) => f.id !== factId);
  if (facts.length === entry.facts.length) return state;
  return {
    ...state,
    byId: { ...state.byId, [entryId]: { ...entry, facts } },
  };
}
