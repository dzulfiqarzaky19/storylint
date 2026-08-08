"use server";

// =============================================================================
// Research Server Actions (HANDOFF §8)
//
// PRODUCT RULE 1 — "Nothing enters the wiki without an explicit confirmation."
//
//   `confirmCard` is the ONLY action in this file that writes to the wiki, and
//   it is gated on an explicit `confirmed: true` param via `confirmWikiWrite()`.
//   The other write path in the whole app is `addSuggestionAsFact` in wiki.ts.
//     - advanceTurn reveals canned `more` turns; no wiki write.
//     - keepCard toggles the Kept board (kept_cards); NOT the wiki.
//     - proposeCard sets a card "pending" and reveals the confirmation strip;
//       it writes nothing until confirmCard.
//     - cancelPending clears the pending state and writes nothing
//       (HANDOFF §8: "`Cancel` writes nothing").
//
// CONTRACT-FIRST: stable signatures; trivial bodies call the query/mutation
// layer, otherwise a typed NOT_IMPLEMENTED stub for a later phase.
// =============================================================================

import { confirmWikiWrite } from "./confirmation";
import { markKeptInWiki, insertFact } from "../db/mutations";
import type { Kind } from "../domain/types";

function notImplemented(name: string): never {
  throw new Error(`NOT_IMPLEMENTED: ${name}`);
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---- Thread progression (no wiki write) -----------------------------------

/**
 * Reveal the next deferred ("more") turn in the thread, e.g. after a prompt
 * chip is clicked. Mirrors reducer action `ADVANCE_TURN`.
 */
export async function advanceTurn(): Promise<ActionResult<{ revealedTurnIds: string[] }>> {
  // STUB (Phase 5): mark the next hidden turn(s) revealed and return their ids.
  return notImplemented("research.advanceTurn");
}

/**
 * Toggle a proposition card on the Kept board ("Keep" ⇄ "Kept"). Persists to
 * kept_cards, NOT the wiki. Mirrors reducer action `KEEP_CARD`.
 */
export async function keepCard(
  propositionId: string,
  kept: boolean,
): Promise<ActionResult> {
  void propositionId;
  void kept;
  // STUB (Phase 5): upsertKeptCard({ propositionId, keptAt }) or delete when kept=false.
  return notImplemented("research.keepCard");
}

/**
 * Set a card "pending" ("Make it an entry") which reveals the confirmation
 * strip. Writes NOTHING to the wiki. Mirrors reducer action `PROPOSE_CARD`.
 */
export async function proposeCard(propositionId: string): Promise<ActionResult> {
  void propositionId;
  // No persistence: pending is session state. Server action kept for uniform pairing.
  return { ok: true, data: undefined };
}

/**
 * Clear the pending card without writing ("Cancel"). Mirrors reducer action
 * `CANCEL_PENDING`.
 */
export async function cancelPending(): Promise<ActionResult> {
  // No persistence: clears reducer pending state only.
  return { ok: true, data: undefined };
}

// ---- WIKI WRITE (confirmation-gated) --------------------------------------

/**
 * WIKI WRITE (product rule 1). Write a pending proposition into the wiki as a
 * new entry ("Yes, write it in"). One of the two only paths that write to the
 * wiki, so it REQUIRES an explicit confirmation.
 *
 * @param input.confirmed must be the literal `true` — the confirmation gate.
 */
export async function confirmCard(input: {
  propositionId: string;
  /** Editable entry fields the confirmation strip collected. */
  entry: {
    name: string;
    kind: Kind;
    summary: string;
  };
  confirmed: true;
}): Promise<ActionResult<{ entryId: string }>> {
  // Mint the token; omitting `confirmed: true` is a compile-time error.
  const confirmation = confirmWikiWrite({ confirmed: input.confirmed });
  void confirmation;
  void markKeptInWiki; // Phase 5: mark the kept card in_wiki after creating the entry
  void insertFact; // Phase 5: seed the new entry's initial fact(s), if any
  // STUB (Phase 5): create the entry, optionally its facts/ties (all via
  // `confirmation`), then markKeptInWiki(propositionId, confirmation).
  return notImplemented("research.confirmCard");
}
