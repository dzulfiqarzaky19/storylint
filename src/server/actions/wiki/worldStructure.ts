"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type ActionResult, runAction } from "@/domain/result";
import { type CascadeCount, deleteCascade, previewCascade as previewCascadeRows } from "@/server/db/cascade";
import { countStructureSiblings } from "@/server/db/structure/queries";
import { linkEntityToWorld as linkEntityToWorldRow, unlinkEntityFromWorld as unlinkEntityFromWorldRow } from "@/server/db/gazetteer/mutations/membership";
import { createFreshUniverse as createFreshUniverseRow, insertBookWithFirstChapter, insertWorld as insertWorldRow, renameBook as renameBookRow, renameUniverse as renameUniverseRow, renameWorld as renameWorldRow } from "@/server/db/structure/mutations";
import { LAST_CHILD_BLOCK, type StructureEdit, type StructureLevel } from "@/domain/wiki/structureEdit";

export interface StructureEditResult {
  universeId?: string;
  worldId?: string;
  bookId?: string;
  removed?: CascadeCount;
}

const SURFACE_OF: Record<StructureLevel, string> = {
  universe: "/wiki",
  world: "/wiki",
  book: "/write",
};

export async function editWorldStructure(
  edit: StructureEdit,
): Promise<ActionResult<StructureEditResult>> {
  return runAction(`wiki.${edit.op}${edit.level[0]!.toUpperCase()}${edit.level.slice(1)}`, async () => {
    const result = await applyEdit(edit);
    if (!result.ok) return result;
    revalidatePath(SURFACE_OF[edit.level]);
    return result;
  });
}

async function applyEdit(edit: StructureEdit): Promise<ActionResult<StructureEditResult>> {
  switch (edit.op) {
    case "create":
      return createLevel(edit);
    case "rename":
      return renameLevel(edit);
    case "delete":
      return deleteLevel(edit);
  }
}

async function createLevel(
  edit: Extract<StructureEdit, { op: "create" }>,
): Promise<ActionResult<StructureEditResult>> {
  switch (edit.level) {
    case "universe": {
      const ids = { universeId: randomUUID(), worldId: randomUUID(), bookId: randomUUID() };
      await createFreshUniverseRow({ ...ids, universeName: edit.name });
      return { ok: true, data: ids };
    }
    case "world": {
      const worldId = randomUUID();
      const bookId = randomUUID();
      await insertWorldRow({
        id: worldId,
        universeId: edit.universeId,
        title: edit.name,
        bookId,
      });
      return { ok: true, data: { worldId, bookId } };
    }
    case "book": {
      const bookId = randomUUID();
      await insertBookWithFirstChapter({
        id: bookId,
        name: edit.name,
        worldId: edit.worldId,
        firstChapterId: randomUUID(),
        firstChapterTitle: "Chapter One",
        firstChapterBody: { type: "doc", content: [{ type: "paragraph" }] },
      });
      return { ok: true, data: { bookId } };
    }
  }
}

async function renameLevel(
  edit: Extract<StructureEdit, { op: "rename" }>,
): Promise<ActionResult<StructureEditResult>> {
  if (edit.level === "universe") await renameUniverseRow({ id: edit.id, name: edit.name });
  else if (edit.level === "world") await renameWorldRow({ id: edit.id, title: edit.name });
  else await renameBookRow({ id: edit.id, name: edit.name });
  return { ok: true, data: {} };
}

async function deleteLevel(
  edit: Extract<StructureEdit, { op: "delete" }>,
): Promise<ActionResult<StructureEditResult>> {
  if (edit.confirmed !== true) {
    return { ok: false, error: `wiki.delete${edit.level}: not confirmed` };
  }
  if (edit.level !== "universe") {
    const siblings = await countStructureSiblings(edit.level, edit.id);
    if (siblings <= 1) return { ok: false, error: LAST_CHILD_BLOCK[edit.level] };
  }
  const removed = await deleteCascade({ kind: edit.level, id: edit.id });
  return { ok: true, data: { removed } };
}

export async function previewStructureDelete(input: {
  level: StructureLevel;
  id: string;
}): Promise<ActionResult<CascadeCount>> {
  return runAction("wiki.previewStructureDelete", async () => {
    const preview = await previewCascadeRows({ kind: input.level, id: input.id });
    return { ok: true, data: preview };
  });
}

export async function shareEntityToWorld(input: {
  worldId: string;
  entityId: string;
}): Promise<ActionResult> {
  return runAction("wiki.shareEntityToWorld", async () => {
    await linkEntityToWorldRow(input.worldId, input.entityId);
    revalidatePath("/wiki");
    return { ok: true, data: undefined };
  });
}

export async function unshareEntityFromWorld(input: {
  worldId: string;
  entityId: string;
}): Promise<ActionResult> {
  return runAction("wiki.unshareEntityFromWorld", async () => {
    await unlinkEntityFromWorldRow(input.worldId, input.entityId);
    revalidatePath("/wiki");
    return { ok: true, data: undefined };
  });
}
