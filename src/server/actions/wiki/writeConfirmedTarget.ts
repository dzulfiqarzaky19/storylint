"use server";

import {
  type ActionResult,
  type WikiWriteConfirmation,
  confirmWikiWrite,
  requireWorldId,
  runActionBare,
} from "@/domain/result";
import { getEntry } from "@/server/db/gazetteer/reads";
import {
  getProposition,
  markKeptInWiki,
  upsertKeptCard,
} from "@/server/db/research/mutations";
import { createCategory, getMaxCategorySortOrder } from "@/server/db/gazetteer/mutations/categories";
import { getMaxSortOrderForFacts, insertFact, updateFact } from "@/server/db/gazetteer/mutations/facts";
import { getMaxSortOrderForShelf, insertEntryLinkedToWorld } from "@/server/db/gazetteer/mutations/entries";
import { KIND_SHELF, type Kind, type Shelf } from "@/domain/types";
import { defaultCategoryShelf } from "@/domain/wiki/categoryLabels";
import type { PickerOrigin, PickerResult } from "@/domain/wiki/pickedTarget";

const VALID_KINDS: readonly string[] = ["character", "world", "organization", "lore"];

function toKind(categoryId: string): Kind {
  return VALID_KINDS.includes(categoryId) ? (categoryId as Kind) : "lore";
}

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

function correctedFactId(origin: PickerOrigin): string | undefined {
  if (origin.from !== "mark") return undefined;
  const factId = origin.mark.checkedAgainst?.factId;
  return origin.mark.kind === "conflict" && factId ? factId : undefined;
}

async function flipCardIntoWiki(
  propositionId: string,
  confirmation: WikiWriteConfirmation,
): Promise<void> {
  await upsertKeptCard({ propositionId, keptAt: Date.now() });
  await markKeptInWiki(propositionId, confirmation);
}

export async function writeConfirmedTarget(input: {
  result: PickerResult;
  origin: PickerOrigin;
  worldId: string;
  confirmed: true;
}): Promise<ActionResult<{ entryId: string }>> {
  const confirmation = confirmWikiWrite({ confirmed: input.confirmed });

  return runActionBare(async () => {
    const { result, origin } = input;
    const ids = idsFor(origin);

    const proposition =
      origin.from === "card" ? await getProposition(origin.propositionId) : null;
    if (origin.from === "card" && !proposition) {
      return { ok: false, error: `Unknown proposition: ${origin.propositionId}` };
    }

    if (result.entryId) {
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

    const proposedCategory = result.proposeCategoryName?.trim();
    let kind: string;
    let shelf: Shelf;
    if (proposedCategory) {
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

    const world = requireWorldId(input.worldId, "writeConfirmedTarget");
    if (!world.ok) return world;

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
