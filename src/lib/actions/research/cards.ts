"use server";

// ============================================================================
// Research card server actions (keep / propose / cancel / confirm)
// Split out of the former monolithic research.ts (T-ARCH-9). runAction/runActionBare
// envelopes are unchanged; only file boundaries moved.
// ============================================================================

import { type ActionResult, confirmWikiWrite, requireWorldId, runActionBare } from "../confirmation";
import {
  deleteKeptCard,
  getProposition,
  markKeptInWiki,
  upsertKeptCard,
} from "../../db/research-mutations";
import {
  getMaxSortOrderForFacts,
  getMaxSortOrderForShelf,
  insertEntryLinkedToWorld,
  insertFact,
} from "../../db/gazetteer-mutations";
import { type Kind, type Shelf } from "../../domain/types";
import { complete } from "../../ai/saarouters";
import { getEntry, loadWorldSnapshot } from "../../db/gazetteer";

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

// ---- WIKI WRITE (confirmation-gated) --------------------------------------

/**
 * WIKI WRITE (product rule 1). Write a pending proposition into the wiki as a
 * new entry ("Yes, write it in"). One of the two only paths that write to the
 * wiki, so it REQUIRES an explicit confirmation.
 *
 * Steps (all under the minted token): create the entry, mark the source card
 * as kept + in_wiki. The card is auto-kept so it appears on the board flipped
 * to "In the wiki".
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
  /**
   * F6 enrich-vs-duplicate: when set, the writer chose to fold this card into an
   * EXISTING entry (from `recommendEnrichTarget`) rather than mint a new one. We
   * add the card's summary as a fact on that entry instead of inserting a new
   * `prop-` entry. A soft-deleted / missing target is rejected (getEntry filters
   * `deleted_at IS NULL`), so a card can never enrich a tombstone.
   */
  enrichEntryId?: string;
  /**
   * TCK-E06 (research slice): the world the writer is viewing. A newly-MINTED
   * entry is invisible on /wiki until it has a world_entities link to this world
   * (loadWorldSnapshot JOINs membership on the active world). Required for the
   * mint branch; the enrich branch ignores it (its target is already linked).
   */
  worldId: string;
  category?: { id: string; shelf: Shelf };
  confirmed: true;
}): Promise<ActionResult<{ entryId: string }>> {
  // Mint the token; omitting `confirmed: true` is a compile-time error. This is
  // the single gate that authorizes every wiki write below.
  const confirmation = confirmWikiWrite({ confirmed: input.confirmed });

  return runActionBare(async () => {
    const prop = await getProposition(input.propositionId);
    if (!prop) {
      return { ok: false, error: `Unknown proposition: ${input.propositionId}` };
    }

    // F6 ENRICH BRANCH — fold the card into an existing entry instead of minting
    // a duplicate. The target must be LIVE: getEntry filters `deleted_at IS NULL`,
    // so a null here means the entry is soft-deleted or gone — reject rather than
    // silently resurrect a tombstone or write an orphan fact.
    if (input.enrichEntryId) {
      const target = await getEntry(input.enrichEntryId);
      if (!target) {
        return {
          ok: false,
          error: `Cannot enrich a removed entry: ${input.enrichEntryId}`,
        };
      }
      // Stable fact id keyed by the proposition so re-confirming the same card
      // updates the fact in place (insertFact is now idempotent) instead of
      // stacking duplicates on the target entry.
      const factId = `prop-fact-${input.propositionId}`;
      const nextFactSort = (await getMaxSortOrderForFacts(input.enrichEntryId)) + 1;
      await insertFact(
        {
          id: factId,
          entryId: input.enrichEntryId,
          key: input.entry.name,
          value: input.entry.summary,
          fresh: true,
          sortOrder: nextFactSort,
        },
        confirmation,
      );

      // The card is still resolved: keep it on the board flipped to "In the wiki".
      await upsertKeptCard({ propositionId: input.propositionId, keptAt: Date.now() });
      await markKeptInWiki(input.propositionId, confirmation);

      return { ok: true, data: { entryId: input.enrichEntryId } };
    }

    // Derive a stable entry id from the proposition so re-confirming is idempotent.
    const entryId = `prop-${input.propositionId}`;
    // A user-created category (picker "+ Add new") drives the entry's kind + shelf
    // directly from the real category row; the built-in path derives shelf from
    // the closed Kind map. Route on the presence of well-formed category data, not
    // a flag - a category object is either a complete {id, shelf} or absent.
    const entryKind = input.category ? input.category.id : input.entry.kind;
    const shelf = input.category ? input.category.shelf : KIND_SHELF[input.entry.kind];
    const nextSort = (await getMaxSortOrderForShelf(shelf)) + 1;

    // TCK-E06 FAIL CLOSED: refuse to mint a persisted-but-invisible world-orphan.
    // A blank/missing worldId means the client could not name the active world, so
    // reject rather than write an entry no /wiki view can ever show (mirrors the
    // wiki-slice requireWorldId message). The enrich branch returns above, so it
    // never reaches here and stays worldId-agnostic.
    const worldGuard = requireWorldId(input.worldId, "confirmCard");
    if (!worldGuard.ok) return worldGuard;
    const worldId = worldGuard.worldId;

    // Entry + world link in ONE transaction: a bad worldId FK-throws and rolls the
    // entry INSERT back with it, so a mint is atomic (never an orphan).
    await insertEntryLinkedToWorld(
      {
        id: entryId,
        kind: entryKind,
        name: input.entry.name,
        catalogueNo: "—",
        note: prop.kind.toLowerCase(),
        summary: input.entry.summary,
        shelf,
        sortOrder: nextSort,
      },
      worldId,
      confirmation,
    );

    // The card must exist on the board before we can flip it to in_wiki.
    await upsertKeptCard({ propositionId: input.propositionId, keptAt: Date.now() });
    await markKeptInWiki(input.propositionId, confirmation);

    return { ok: true, data: { entryId } };
  });
}

// ---- AI: grounded research answer (session-only, NOT a wiki write) ---------
//
// The writer types a question / half-thought. We ground the model on the
// current wiki snapshot and ask for a short conversational answer plus 2-3
// proposition cards. The result is returned as reducer-shaped turns and lives
// only in session state — it writes NOTHING to the wiki. A card only becomes a
// wiki entry through the existing confirmCard gate (product rule 1 intact).

const KIND_SHELF: Record<Kind, string> = {
  character: "people",
  world: "places",
  organization: "orders",
  lore: "lore",
};
