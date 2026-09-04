"use server";

// ============================================================================
// Research card server actions (keep / propose / cancel)
//
// The wiki write itself is NOT here: "Yes, write it in" goes through
// `writeConfirmedTarget` (actions/wiki), the one module that writes a confirmed
// picker result into the gazetteer for /research and /write alike. Product
// rule 1 is unchanged — that module is the gate.
// ============================================================================

import { type ActionResult, runActionBare } from "../confirmation";
import { deleteKeptCard, upsertKeptCard } from "../../db/research-mutations";

/**
 * Toggle a proposition card on the Kept board ("Keep" ⇄ "Kept"). Persists to
 * kept_cards, NOT the wiki. Mirrors reducer action `KEEP_CARD`.
 */
export async function keepCard(
  propositionId: string,
  kept: boolean,
): Promise<ActionResult> {
  return runActionBare(async () => {
    if (kept) {
      await upsertKeptCard({ propositionId, keptAt: Date.now() });
    } else {
      await deleteKeptCard(propositionId);
    }
    return { ok: true, data: undefined };
  });
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
