"use server";

// =============================================================================
// Wiki Server Actions (HANDOFF §8)
//
// PRODUCT RULE 1 — "Nothing enters the wiki without an explicit confirmation."
//
//   Of the actions in THIS file, `addSuggestionAsFact` is the ONLY one that
//   writes to the wiki, and it is gated on an explicit `confirmed: true` param
//   via `confirmWikiWrite()` (src/lib/actions/confirmation.ts). The other write
//   path in the whole app is `confirmCard` in research.ts. No other action
//   here (selectEntry/moveEntry/linkEntry/moveFact/dismissSuggestion) writes a
//   wiki fact or tie:
//     - selectEntry is read-only UI state.
//     - moveEntry / moveFact persist *arrangement* (shelf/sortOrder, entry_id),
//       not new wiki knowledge.
//     - linkEntry records a directional relationship between existing entries;
//       it does not create entries or facts. (If a future design treats a tie
//       as wiki knowledge, route it through confirmWikiWrite too.)
//     - dismissSuggestion only records a "Leave it" and never writes a fact.
//
//   The wiki-writing DB helpers (insertFact/insertTie/markKeptInWiki) require a
//   WikiWriteConfirmation token, so the type checker rejects any attempt to
//   write to the wiki from a non-confirmed path.
//
// CONTRACT-FIRST: signatures are stable; bodies are either a trivial call into
// the query/mutation layer or a typed `NOT_IMPLEMENTED` stub (clearly marked)
// for Phases 4/5/7 to fill in.
// =============================================================================

import type { Shelf } from "../domain/types";
import { confirmWikiWrite } from "./confirmation";
import { insertFact } from "../db/mutations";

/** Marker for stub bodies awaiting a later phase. */
function notImplemented(name: string): never {
  throw new Error(`NOT_IMPLEMENTED: ${name}`);
}

// ---- Result envelope ------------------------------------------------------

/**
 * Every action returns a discriminated result so the client store can surface a
 * failed write instead of letting it vanish (HANDOFF §8: "a failed write must
 * surface, not vanish").
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---- Read-only selection --------------------------------------------------

/**
 * Set the focused entry. Read-only session state; persisted nowhere. Mirrors
 * reducer action `SELECT_ENTRY`.
 */
export async function selectEntry(entryId: string): Promise<ActionResult> {
  void entryId;
  // No persistence: selection lives in the reducer. Server action exists so the
  // store's "action + matching server action" pairing is uniform.
  return { ok: true, data: undefined };
}

// ---- Arrangement (does NOT write wiki knowledge) --------------------------

/**
 * Persist a tile's new shelf placement / order after a drag (append to a shelf,
 * or insert before another tile). Mirrors reducer action `MOVE_ENTRY`.
 *
 * @param entryId  the dragged entry
 * @param toShelf  destination shelf (kind grouping)
 * @param beforeId insert before this entry id, or null to append
 */
export async function moveEntry(
  entryId: string,
  toShelf: Shelf,
  beforeId: string | null,
): Promise<ActionResult> {
  void entryId;
  void toShelf;
  void beforeId;
  // STUB (Phase 4): compute sortOrder from beforeId, call
  // updateEntryShelfOrder({ entryId, shelf: toShelf, sortOrder }).
  return notImplemented("wiki.moveEntry");
}

/**
 * Record a directional tie between two existing entries (drag a tile onto the
 * Ties block). Does not create entries or facts. Mirrors reducer `LINK_ENTRY`.
 */
export async function linkEntry(
  fromEntryId: string,
  toEntryId: string,
  rel: string,
): Promise<ActionResult> {
  void fromEntryId;
  void toEntryId;
  void rel;
  // STUB (Phase 4): insert the directional tie(s). See note in the rule-1 header
  // about whether ties count as wiki knowledge for this design.
  return notImplemented("wiki.linkEntry");
}

/**
 * Move a fact from one entry to another (drag a fact row between tiles).
 * Rearrangement of existing knowledge, not a new wiki write. Mirrors reducer
 * `MOVE_FACT`.
 */
export async function moveFact(
  factId: string,
  toEntryId: string,
): Promise<ActionResult> {
  void factId;
  void toEntryId;
  // STUB (Phase 4): updateFactEntry({ factId, toEntryId, sortOrder }).
  return notImplemented("wiki.moveFact");
}

// ---- WIKI WRITE (confirmation-gated) --------------------------------------

/**
 * WIKI WRITE (product rule 1). Turn a poster-band suggestion into a recorded
 * fact on an entry. This is one of the two only paths that write to the wiki,
 * so it REQUIRES an explicit confirmation.
 *
 * @param input.confirmed must be the literal `true` — the confirmation gate.
 */
export async function addSuggestionAsFact(input: {
  suggestionKey: string;
  entryId: string;
  key: string;
  value: string;
  confirmed: true;
}): Promise<ActionResult<{ factId: string }>> {
  // Mint the token; a caller that omits `confirmed: true` fails to type-check.
  const confirmation = confirmWikiWrite({ confirmed: input.confirmed });
  void confirmation;
  void insertFact; // wired in Phase 4 with a generated id + computed sortOrder
  // STUB (Phase 4): const fact = await insertFact({ id, entryId, key, value,
  //   fresh: true, sortOrder }, confirmation); return { ok: true, data: { factId: fact.id } };
  return notImplemented("wiki.addSuggestionAsFact");
}

/**
 * Record that a poster suggestion was dismissed ("Leave it"). Never writes a
 * fact. Mirrors reducer `DISMISS_SUGGESTION`.
 */
export async function dismissSuggestion(
  suggestionKey: string,
): Promise<ActionResult> {
  void suggestionKey;
  // STUB (Phase 4): insertDismissedSuggestion(suggestionKey).
  return notImplemented("wiki.dismissSuggestion");
}
