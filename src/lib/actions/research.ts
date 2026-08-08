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
//   insertEntry (the wiki write) requires a WikiWriteConfirmation token, so the
//   type checker rejects any attempt to create an entry from a non-confirmed
//   path — the invariant is enforced at the action boundary, not just the UI.
// =============================================================================

import { confirmWikiWrite } from "./confirmation";
import {
  markKeptInWiki,
  upsertKeptCard,
  deleteKeptCard,
  insertEntry,
  getProposition,
  getMaxSortOrderForShelf,
  insertResearchThread,
  getNextResearchThreadSortOrder,
} from "../db/mutations";
import { randomUUID } from "node:crypto";
import type { Kind } from "../domain/types";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** kind -> shelf (HANDOFF §6). Matches the seed's KIND_SHELF. */
const KIND_SHELF: Record<Kind, string> = {
  character: "people",
  world: "places",
  organization: "orders",
  lore: "lore",
};

// ---- Thread progression (no wiki write) -----------------------------------

/**
 * Reveal the next deferred ("more") turn(s) in the thread after a prompt chip
 * is clicked. The `more` turns are canned (HANDOFF §9.4); the UI passes the
 * currently-hidden turn ids and this returns them as revealed. No persistence:
 * revealed-ness is session state. Mirrors reducer action `ADVANCE_TURN`.
 */
export async function advanceTurn(
  hiddenTurnIds: string[],
): Promise<ActionResult<{ revealedTurnIds: string[] }>> {
  // Reveal all remaining deferred turns (the prototype's single `more` batch).
  return { ok: true, data: { revealedTurnIds: hiddenTurnIds } };
}

/**
 * Toggle a proposition card on the Kept board ("Keep" ⇄ "Kept"). Persists to
 * kept_cards, NOT the wiki. Mirrors reducer action `KEEP_CARD`.
 */
export async function keepCard(
  propositionId: string,
  kept: boolean,
): Promise<ActionResult> {
  try {
    if (kept) {
      await upsertKeptCard({ propositionId, keptAt: Date.now() });
    } else {
      await deleteKeptCard(propositionId);
    }
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
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
 * Steps (all under the minted token): create the entry, mark the source card
 * as kept + in_wiki. The card is auto-kept so it appears on the board flipped
 * to "In the wiki" (HANDOFF §8 / README behavior table).
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
  // Mint the token; omitting `confirmed: true` is a compile-time error. This is
  // the single gate that authorizes every wiki write below.
  const confirmation = confirmWikiWrite({ confirmed: input.confirmed });

  try {
    const prop = await getProposition(input.propositionId);
    if (!prop) {
      return { ok: false, error: `Unknown proposition: ${input.propositionId}` };
    }

    // Derive a stable entry id from the proposition so re-confirming is idempotent.
    const entryId = `prop-${input.propositionId}`;
    const shelf = KIND_SHELF[input.entry.kind];
    const nextSort = (await getMaxSortOrderForShelf(shelf)) + 1;

    await insertEntry(
      {
        id: entryId,
        kind: input.entry.kind,
        name: input.entry.name,
        catalogueNo: "—",
        note: prop.kind.toLowerCase(),
        summary: input.entry.summary,
        shelf,
        sortOrder: nextSort,
      },
      confirmation,
    );

    // The card must exist on the board before we can flip it to in_wiki.
    await upsertKeptCard({ propositionId: input.propositionId, keptAt: Date.now() });
    await markKeptInWiki(input.propositionId, confirmation);

    return { ok: true, data: { entryId } };
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---- Research threads (Track B) — NOT a wiki write ------------------------
// Creating a thread opens an empty conversation column; it never writes an
// entry, so it needs no confirmation token (product rule 1 is about wiki
// writes). Returns the new thread id so the client can navigate to it.

export async function createThread(input?: {
  title?: string;
  subtitle?: string;
}): Promise<ActionResult<{ threadId: string }>> {
  try {
    const id = randomUUID();
    const sortOrder = await getNextResearchThreadSortOrder();
    const row = await insertResearchThread({
      id,
      title: input?.title?.trim() || "New thread",
      subtitle: input?.subtitle?.trim() ?? "",
      sortOrder,
    });
    return { ok: true, data: { threadId: row.id } };
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
}
