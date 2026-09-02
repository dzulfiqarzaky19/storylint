// Pure tie transitions. createTiedInState composes the entries base
// (createEntryInState + linkEntryInState). Split out of the former monolithic
// wikiStore.ts (T-ARCH-15).
import type { Kind, ResolvedTie, Shelf } from "../../domain/types";
import type { WikiState } from "./types";
import { createEntryInState } from "./entries";

/** Append a directional tie to the source entry (pure). Target display fields
 *  come from the destination entry already in state. */
export function linkEntryInState(
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

/**
 * Remove exactly ONE tie from an entry's `ties[]` (pure). Untie is an
 * intentional removal, so the tie is dropped outright — no tombstone (that is
 * reserved for a soft-deleted TARGET, whose inbound ties survive as dangling
 * badges). Removes only the addressed `tieId`, leaving every other tie on the
 * entry intact. No-op if the entry is unknown or holds no such tie.
 */
export function untieInState(state: WikiState, fromEntryId: string, tieId: string): WikiState {
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
