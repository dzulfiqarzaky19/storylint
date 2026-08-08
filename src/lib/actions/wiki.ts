"use server";

// =============================================================================
// Wiki Server Actions (HANDOFF §8)
//
// PRODUCT RULE 1 — "Nothing enters the wiki without an explicit confirmation."
//
//   Of the actions in THIS file, `addSuggestionAsFact` is the ONLY one that
//   writes new wiki knowledge, and it is gated on an explicit `confirmed: true`
//   param via `confirmWikiWrite()`. `linkEntry` creates a directional tie
//   between existing entries; the design treats a tie as an arrangement (a
//   relationship the writer draws), not new prose knowledge, but because the DB
//   helper `insertTie` still demands a confirmation token, linkEntry routes
//   through the gate as well (defence in depth). The other actions
//   (selectEntry/moveEntry/moveFact/dismissSuggestion) persist arrangement or a
//   dismissal, never a new fact.
//
// Each action returns an ActionResult so the client store can SURFACE a failed
// write instead of letting it vanish (HANDOFF §8: per-mutation, no silent
// write-behind).
// =============================================================================

import { randomUUID } from "node:crypto";
import type { Shelf } from "../domain/types";
import { confirmWikiWrite } from "./confirmation";
import {
  insertFact,
  insertTie,
  updateFactEntry,
  reorderShelf,
  insertDismissedSuggestion,
} from "../db/mutations";

// ---- Result envelope ------------------------------------------------------

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(err: unknown, where: string): { ok: false; error: string } {
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, error: `${where}: ${msg}` };
}

// ---- Read-only selection --------------------------------------------------

/** Set the focused entry. Read-only session state; persisted nowhere. */
export async function selectEntry(entryId: string): Promise<ActionResult> {
  void entryId;
  return { ok: true, data: undefined };
}

// ---- Arrangement (does NOT write wiki knowledge) --------------------------

/**
 * Persist a tile's new placement after a drag. The client sends the destination
 * shelf and the FULL ordered id list for that shelf (what the reducer already
 * computed), so the DB matches the UI exactly. If the drag moved the entry
 * across shelves, the source shelf's remaining order is sent too. Mirrors
 * reducer `MOVE_ENTRY`.
 */
export async function moveEntry(input: {
  entryId: string;
  toShelf: Shelf;
  toShelfOrder: string[];
  fromShelf: Shelf;
  fromShelfOrder: string[];
}): Promise<ActionResult> {
  try {
    // Persist destination first, then source (a cross-shelf move renumbers both).
    await reorderShelf({ shelf: input.toShelf, orderedIds: input.toShelfOrder });
    if (input.fromShelf !== input.toShelf) {
      await reorderShelf({
        shelf: input.fromShelf,
        orderedIds: input.fromShelfOrder,
      });
    }
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "wiki.moveEntry");
  }
}

/**
 * Record a directional tie between two existing entries (drag a tile onto the
 * Ties block). Does not create entries or facts. Mirrors reducer `LINK_ENTRY`.
 * Returns the new tie id so the reducer and DB agree.
 */
export async function linkEntry(input: {
  fromEntryId: string;
  toEntryId: string;
  rel: string;
}): Promise<ActionResult<{ tieId: string }>> {
  try {
    // A tie between existing entries is an arrangement, but insertTie demands a
    // confirmation token (product rule 1, defence in depth) — mint it here.
    const confirmation = confirmWikiWrite({ confirmed: true });
    const id = randomUUID();
    const tie = await insertTie(
      {
        id,
        fromEntryId: input.fromEntryId,
        toEntryId: input.toEntryId,
        rel: input.rel,
      },
      confirmation,
    );
    return { ok: true, data: { tieId: tie.id } };
  } catch (err) {
    return fail(err, "wiki.linkEntry");
  }
}

/**
 * Move a fact from one entry to another (drag a fact row between tiles).
 * Rearrangement of existing knowledge, not a new wiki write. Mirrors reducer
 * `MOVE_FACT`. `sortOrder` places the fact at the end of the destination entry.
 */
export async function moveFact(input: {
  factId: string;
  toEntryId: string;
  sortOrder: number;
}): Promise<ActionResult> {
  try {
    await updateFactEntry({
      factId: input.factId,
      toEntryId: input.toEntryId,
      sortOrder: input.sortOrder,
    });
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "wiki.moveFact");
  }
}

// ---- WIKI WRITE (confirmation-gated) --------------------------------------

/**
 * WIKI WRITE (product rule 1). Turn a poster-band suggestion into a recorded
 * fact on an entry. One of the two only paths that write new wiki knowledge, so
 * it REQUIRES an explicit confirmation. The new fact is `fresh` (drives the
 * --fresh row background). Returns the generated fact id.
 *
 * @param input.confirmed must be the literal `true` — the confirmation gate.
 */
export async function addSuggestionAsFact(input: {
  suggestionKey: string;
  entryId: string;
  key: string;
  value: string;
  sortOrder: number;
  confirmed: true;
}): Promise<ActionResult<{ factId: string }>> {
  try {
    // Mint the token; a caller that omits `confirmed: true` fails to type-check.
    const confirmation = confirmWikiWrite({ confirmed: input.confirmed });
    const id = randomUUID();
    const fact = await insertFact(
      {
        id,
        entryId: input.entryId,
        key: input.key,
        value: input.value,
        fresh: true,
        sortOrder: input.sortOrder,
      },
      confirmation,
    );
    // Adding it IS the resolution — record the dismissal so it does not re-appear
    // on reload (the suggestion is now written down).
    await insertDismissedSuggestion(input.suggestionKey);
    return { ok: true, data: { factId: fact.id } };
  } catch (err) {
    return fail(err, "wiki.addSuggestionAsFact");
  }
}

/**
 * Record that a poster suggestion was dismissed ("Leave it"). Never writes a
 * fact. Mirrors reducer `DISMISS_SUGGESTION`.
 */
export async function dismissSuggestion(
  suggestionKey: string,
): Promise<ActionResult> {
  try {
    await insertDismissedSuggestion(suggestionKey);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "wiki.dismissSuggestion");
  }
}
