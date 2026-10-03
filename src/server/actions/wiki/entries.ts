"use server";

import { randomUUID } from "node:crypto";
import { type Kind, type Shelf } from "@/domain/types";
import { type ActionResult, confirmWikiWrite, requireWorldId, runAction } from "@/domain/result";
import { createEntryWithTie, deleteTie, insertTie } from "@/server/db/gazetteer/mutations/ties";
import { deleteFact as deleteFactMutation, getMaxSortOrderForFacts, insertFact, updateFact, updateFactEntry } from "@/server/db/gazetteer/mutations/facts";
import { getMaxSortOrderForShelf, insertEntryLinkedToWorld, reorderShelf, softDeleteEntry as softDeleteEntryRow, updateEntryFields } from "@/server/db/gazetteer/mutations/entries";
import { insertDismissedSuggestion } from "@/server/db/chapters/mutations";

export async function selectEntry(entryId: string): Promise<ActionResult> {
  void entryId;
  return { ok: true, data: undefined };
}

export async function moveEntry(input: {
  entryId: string;
  toShelf: Shelf;
  toShelfOrder: string[];
  fromShelf: Shelf;
  fromShelfOrder: string[];
}): Promise<ActionResult> {
  return runAction("wiki.moveEntry", async () => {
    await reorderShelf({ shelf: input.toShelf, orderedIds: input.toShelfOrder });
    if (input.fromShelf !== input.toShelf) {
      await reorderShelf({
        shelf: input.fromShelf,
        orderedIds: input.fromShelfOrder,
      });
    }
    return { ok: true, data: undefined };
  });
}

export async function linkEntry(input: {
  id?: string;
  fromEntryId: string;
  toEntryId: string;
  rel: string;
}): Promise<ActionResult<{ tieId: string }>> {
  return runAction("wiki.linkEntry", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    const id = input.id ?? randomUUID();
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
  });
}

export async function untie(input: { tieId: string }): Promise<ActionResult> {
  return runAction("wiki.untie", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await deleteTie(input.tieId, confirmation);
    return { ok: true, data: undefined };
  });
}

export async function createEntryTied(input: {
  entryId?: string;
  tieId?: string;
  name: string;
  kind: Kind;
  shelf: Shelf;
  toEntryId: string;
  rel: string;
  confirmed: true;
  worldId: string;
}): Promise<ActionResult<{ entryId: string; tieId: string }>> {
  return runAction("wiki.createEntryTied", async () => {
    const world = requireWorldId(input.worldId, "wiki.createEntryTied");
    if (!world.ok) return world;
    const confirmation = confirmWikiWrite({ confirmed: input.confirmed });
    const entryId = input.entryId ?? randomUUID();
    const tieId = input.tieId ?? randomUUID();
    await createEntryWithTie(
      {
        entry: {
          id: entryId,
          kind: input.kind,
          name: input.name,
          catalogueNo: "",
          note: "",
          summary: "",
          shelf: input.shelf,
          sortOrder: await getMaxSortOrderForShelf(input.shelf) + 1,
        },
        tie: { id: tieId, fromEntryId: input.toEntryId, toEntryId: entryId, rel: input.rel },
        worldId: world.worldId,
      },
      confirmation,
    );
    return { ok: true, data: { entryId, tieId } };
  });
}

export async function moveFact(input: {
  factId: string;
  toEntryId: string;
  sortOrder: number;
}): Promise<ActionResult> {
  return runAction("wiki.moveFact", async () => {
    await updateFactEntry({
      factId: input.factId,
      toEntryId: input.toEntryId,
      sortOrder: input.sortOrder,
    });
    return { ok: true, data: undefined };
  });
}

export async function addSuggestionAsFact(input: {
  factId?: string;
  suggestionKey: string;
  worldId: string;
  entryId: string;
  key: string;
  value: string;
  sortOrder: number;
  confirmed: true;
}): Promise<ActionResult<{ factId: string }>> {
  return runAction("wiki.addSuggestionAsFact", async () => {
    const confirmation = confirmWikiWrite({ confirmed: input.confirmed });
    const id = input.factId ?? randomUUID();
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
    await insertDismissedSuggestion({ worldId: input.worldId, suggestionKey: input.suggestionKey });
    return { ok: true, data: { factId: fact.id } };
  });
}

export async function dismissSuggestion(input: {
  worldId: string;
  suggestionKey: string;
}): Promise<ActionResult> {
  return runAction("wiki.dismissSuggestion", async () => {
    await insertDismissedSuggestion(input);
    return { ok: true, data: undefined };
  });
}

export async function editEntry(input: {
  entryId: string;
  name?: string;
  note?: string;
  summary?: string;
  catalogueNo?: string;
}): Promise<ActionResult> {
  return runAction("wiki.editEntry", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await updateEntryFields(
      {
        id: input.entryId,
        name: input.name,
        note: input.note,
        summary: input.summary,
        catalogueNo: input.catalogueNo,
      },
      confirmation,
    );
    return { ok: true, data: undefined };
  });
}

export async function editFact(input: {
  factId: string;
  key?: string;
  value?: string;
}): Promise<ActionResult> {
  return runAction("wiki.editFact", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await updateFact({ id: input.factId, key: input.key, value: input.value }, confirmation);
    return { ok: true, data: undefined };
  });
}

export async function createEntry(input: {
  id?: string;
  kind: string;
  shelf: Shelf;
  name: string;
  note?: string;
  summary?: string;
  worldId: string;
}): Promise<ActionResult<{ entryId: string; sortOrder: number }>> {
  return runAction("wiki.createEntry", async () => {
    const world = requireWorldId(input.worldId, "wiki.createEntry");
    if (!world.ok) return world;
    const confirmation = confirmWikiWrite({ confirmed: true });
    const id = input.id ?? randomUUID();
    const sortOrder = (await getMaxSortOrderForShelf(input.shelf)) + 1;
    await insertEntryLinkedToWorld(
      {
        id,
        kind: input.kind,
        name: input.name,
        catalogueNo: "—",
        note: input.note ?? "",
        summary: input.summary ?? "",
        shelf: input.shelf,
        sortOrder,
      },
      world.worldId,
      confirmation,
    );
    return { ok: true, data: { entryId: id, sortOrder } };
  });
}

export async function softDeleteEntry(input: {
  id: string;
}): Promise<ActionResult> {
  return runAction("wiki.softDeleteEntry", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await softDeleteEntryRow({ id: input.id, deletedAt: Date.now() }, confirmation);
    return { ok: true, data: undefined };
  });
}

export async function createFact(input: {
  id?: string;
  entryId: string;
  key: string;
  value: string;
  sortOrder?: number;
}): Promise<ActionResult<{ factId: string }>> {
  return runAction("wiki.createFact", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    const id = input.id ?? randomUUID();
    const sortOrder =
      input.sortOrder ?? (await getMaxSortOrderForFacts(input.entryId)) + 1;
    const fact = await insertFact(
      {
        id,
        entryId: input.entryId,
        key: input.key,
        value: input.value,
        fresh: true,
        sortOrder,
      },
      confirmation,
    );
    return { ok: true, data: { factId: fact.id } };
  });
}

export async function deleteFact(input: {
  factId: string;
}): Promise<ActionResult<{ ok: true }>> {
  return runAction("wiki.deleteFact", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await deleteFactMutation(input.factId, confirmation);
    return { ok: true, data: { ok: true } };
  });
}
