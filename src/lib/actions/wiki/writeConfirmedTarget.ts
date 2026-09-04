"use server";

// =============================================================================
// Writing a confirmed picker result into the gazetteer — ONE module (T-DEEP-2).
//
// The "Add to the wiki" modal is producer-agnostic: /write opens it on a check
// Mark, /research on a proposition card. Both then had to perform the SAME
// write by hand, and each had to know four things to get it right:
//
//   1. ORDERING. A brand-new category must become a real `categories` row
//      BEFORE the entry, or the entry's kind falls back to `lore` instead of
//      the category the writer just named.
//   2. THE IDEMPOTENT ID SCHEME. `mark-fact-<markKey>` / `mint-<markKey>` /
//      `prop-<propositionId>` / `prop-fact-<propositionId>` / `cat-<key>` —
//      stable, origin-keyed ids are what make a double-confirm update in place
//      (insertFact and insertEntry are both ON CONFLICT (id) DO UPDATE) rather
//      than stack a duplicate.
//   3. THE CORRECTION RULE. Resolving a CONTRADICTION must EDIT the fact it
//      contradicts, not append beside it — otherwise the wiki holds both the
//      old value and its correction and the next check re-flags the conflict.
//   4. THE LIVENESS ERROR MODE. An enrich target that is soft-deleted or gone
//      must be REJECTED, never silently resurrected as a tombstone write.
//      /research checked this; /write did not.
//
// A caller now states the writer's choice and where it came from. Everything
// above is decided here, once. `resolvePickerTarget` and `resolveWikiWriteMode`
// were the two pure fragments of this decision; they are internals now, because
// they only ever existed to bend a PickerResult into one call site's argument
// names.
//
// Product rule 1 is unchanged and still explicit: the modal's confirm is the
// gate, `confirmed: true` is the caller's proof, and every write below runs
// under the one minted token.
// =============================================================================

import {
  type ActionResult,
  type WikiWriteConfirmation,
  confirmWikiWrite,
  requireWorldId,
  runActionBare,
} from "../confirmation";
import { getEntry } from "../../db/gazetteer";
import {
  getProposition,
  markKeptInWiki,
  upsertKeptCard,
} from "../../db/research-mutations";
import {
  createCategory,
  getMaxCategorySortOrder,
  getMaxSortOrderForFacts,
  getMaxSortOrderForShelf,
  insertEntryLinkedToWorld,
  insertFact,
  updateFact,
} from "../../db/gazetteer-mutations";
import { KIND_SHELF, type Kind, type Shelf } from "../../domain/types";
import { defaultCategoryShelf } from "../../wiki/categoryLabels";
import type { PickerOrigin, PickerResult } from "../../wiki/pickedTarget";

const VALID_KINDS: readonly string[] = ["character", "world", "organization", "lore"];

/**
 * Narrow a picked category id to the closed `Kind` union the built-in shelf map
 * needs. Built-in category ids equal the Kind strings; a user category id (or
 * the empty sentinel of a brand-new category) falls back to `lore`.
 *
 * KNOWN NARROWING, carried over verbatim: minting into an EXISTING user category
 * therefore files the entry under the lore shelf. Widening that is a product
 * decision about where user categories shelve, not part of this consolidation —
 * but it is now one decision in one place rather than two copies.
 */
function toKind(categoryId: string): Kind {
  return VALID_KINDS.includes(categoryId) ? (categoryId as Kind) : "lore";
}

/**
 * The stable ids a re-confirm reuses, keyed by what the writer was looking at.
 * The two schemes differ only in prefix; both make the write idempotent.
 */
function idsFor(origin: PickerOrigin): { entry: string; fact: string; category: string } {
  return origin.from === "mark"
    ? {
        entry: `mint-${origin.mark.markKey}`,
        fact: `mark-fact-${origin.mark.markKey}`,
        category: `cat-${origin.mark.markKey}`,
      }
    : {
        entry: `prop-${origin.propositionId}`,
        fact: `prop-fact-${origin.propositionId}`,
        category: `cat-${origin.propositionId}`,
      };
}

/**
 * The fact this confirmation CORRECTS in place, when there is one. Only a
 * contradiction that the check resolved to a real `facts` row has one; every
 * other enrich appends. See rule 3 in the file header.
 */
function correctedFactId(origin: PickerOrigin): string | undefined {
  if (origin.from !== "mark") return undefined;
  const factId = origin.mark.checkedAgainst?.factId;
  return origin.mark.kind === "conflict" && factId ? factId : undefined;
}

/** A written-in card stays on the board, flipped to "In the wiki". */
async function flipCardIntoWiki(
  propositionId: string,
  confirmation: WikiWriteConfirmation,
): Promise<void> {
  // The card must exist on the board before it can be flipped.
  await upsertKeptCard({ propositionId, keptAt: Date.now() });
  await markKeptInWiki(propositionId, confirmation);
}

/**
 * WIKI WRITE (product rule 1). Record what the writer confirmed in the picker.
 *
 * ENRICH (`result.entryId` set) folds a fact onto that live entry — correcting
 * the contradicted row when the origin is a conflict mark, else appending.
 * MINT (absent) creates the entry, linked into the active world, minting the
 * proposed category first when the writer named one.
 *
 * @param input.confirmed must be the literal `true` — the confirmation gate.
 * @returns the id of the entry the confirmation landed on (enriched or minted).
 */
export async function writeConfirmedTarget(input: {
  result: PickerResult;
  origin: PickerOrigin;
  /** TCK-E06: the world a MINTED entry is linked into (fail-closed). */
  worldId: string;
  confirmed: true;
}): Promise<ActionResult<{ entryId: string }>> {
  // Mint the token; omitting `confirmed: true` is a compile-time error. This is
  // the single gate that authorizes every write below.
  const confirmation = confirmWikiWrite({ confirmed: input.confirmed });

  return runActionBare(async () => {
    const { result, origin } = input;
    const ids = idsFor(origin);

    // A card origin's proposition supplies the minted entry's note, and must
    // exist before anything is written on its behalf.
    const proposition =
      origin.from === "card" ? await getProposition(origin.propositionId) : null;
    if (origin.from === "card" && !proposition) {
      return { ok: false, error: `Unknown proposition: ${origin.propositionId}` };
    }

    // ---- ENRICH ----------------------------------------------------------
    if (result.entryId) {
      // The target must be LIVE: getEntry filters `deleted_at IS NULL`, so a
      // null here means soft-deleted or gone — reject rather than write an
      // orphan fact onto a tombstone.
      const target = await getEntry(result.entryId);
      if (!target) {
        return { ok: false, error: `Cannot enrich a removed entry: ${result.entryId}` };
      }

      const corrects = correctedFactId(origin);
      if (corrects) {
        await updateFact(
          { id: corrects, key: result.factKey, value: result.factValue },
          confirmation,
        );
      } else {
        await insertFact(
          {
            id: ids.fact,
            entryId: result.entryId,
            key: result.factKey,
            value: result.factValue,
            fresh: true,
            sortOrder: (await getMaxSortOrderForFacts(result.entryId)) + 1,
          },
          confirmation,
        );
      }

      if (origin.from === "card") await flipCardIntoWiki(origin.propositionId, confirmation);
      return { ok: true, data: { entryId: result.entryId } };
    }

    // ---- MINT ------------------------------------------------------------
    // A brand-new category becomes a real row FIRST, so the entry's kind is that
    // category's id and not the `lore` fallback (rule 1). The proposed NAME's
    // presence is what routes here — no separate flag.
    const proposedCategory = result.proposeCategoryName?.trim();
    let kind: string;
    let shelf: Shelf;
    if (proposedCategory) {
      // Origin-keyed id + ON CONFLICT (id) DO NOTHING: a double-fired confirm
      // collapses into the first row instead of minting a duplicate category.
      const category = await createCategory({
        id: ids.category,
        label: proposedCategory,
        shelf: defaultCategoryShelf(),
        sortOrder: await getMaxCategorySortOrder(),
      });
      kind = category.id;
      shelf = category.shelf as Shelf;
    } else {
      const builtin = toKind(result.categoryId);
      kind = builtin;
      shelf = KIND_SHELF[builtin];
    }

    // TCK-E06 FAIL CLOSED: refuse to mint a persisted-but-invisible world-orphan.
    // The enrich branch returned above, so it stays worldId-agnostic.
    const world = requireWorldId(input.worldId, "writeConfirmedTarget");
    if (!world.ok) return world;

    // Entry + world link in ONE transaction: a bad worldId FK-throws and rolls
    // the entry INSERT back with it, so a mint is atomic (never an orphan).
    await insertEntryLinkedToWorld(
      {
        id: ids.entry,
        kind,
        name: result.entryName,
        catalogueNo: "—",
        note: proposition ? proposition.kind.toLowerCase() : "",
        summary: result.factValue,
        shelf,
        sortOrder: (await getMaxSortOrderForShelf(shelf)) + 1,
      },
      world.worldId,
      confirmation,
    );

    if (origin.from === "card") await flipCardIntoWiki(origin.propositionId, confirmation);
    return { ok: true, data: { entryId: ids.entry } };
  });
}
