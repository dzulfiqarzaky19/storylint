"use server";

// =============================================================================
// Editing the world skeleton — ONE action (T-DEEP-7).
//
// Creating, renaming and deleting a universe / world / book was nine server
// actions, and three different screens picked among them. Each screen therefore
// had to know three things that are not its business:
//
//   1. THE LAST-CHILD GUARD. A universe must keep a world; a world must keep a
//      book. That was enforced by DISABLING A BUTTON — `u.worlds.length > 1` in
//      WikiManage, `books.length > 1` in BookPill — while the server action's
//      doc comment asked the caller to please not do it. An invariant guarded by
//      a `disabled` attribute is not guarded. The server refuses now, in the
//      same words the tooltip uses (lib/wiki/structureEdit.ts).
//   2. WHICH PATH TO REVALIDATE. A book edit invalidates /write, a universe or
//      world edit /wiki — hand-picked per action, and omitted entirely on the
//      creates and deletes, which leaned on the caller remembering to refresh.
//   3. THE ID SCHEME. A universe create mints three ids (universe + world +
//      book) so a fresh universe has a home for chapters; a world create mints
//      two. Every caller had to know which came back.
//
// STRUCTURAL, not wiki content: this shapes the skeleton and never writes an
// entry, fact, tie or facet, so product rule 1 does not apply and no
// WikiWriteConfirmation token is minted here. The DELETES are destructive, so
// they stay gated on an explicit `confirmed: true` and return the authoritative
// CascadeCount (total === rows removed).
// =============================================================================

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type ActionResult, runAction } from "../confirmation";
import { type CascadeCount, deleteCascade, previewCascade as previewCascadeRows } from "../../db/cascade";
import { countStructureSiblings } from "../../db/queries";
import {
  linkEntityToWorld as linkEntityToWorldRow,
  unlinkEntityFromWorld as unlinkEntityFromWorldRow,
} from "../../db/gazetteer-mutations";
import {
  createFreshUniverse as createFreshUniverseRow,
  insertBookWithFirstChapter,
  insertWorld as insertWorldRow,
  renameBook as renameBookRow,
  renameUniverse as renameUniverseRow,
  renameWorld as renameWorldRow,
} from "../../db/mutations";
import { DEFAULT_UNIVERSE_ID } from "../../db/scope";
import { LAST_CHILD_BLOCK, type StructureEdit, type StructureLevel } from "../../wiki/structureEdit";

/** What an edit produced: minted ids on a create, removed rows on a delete. */
export interface StructureEditResult {
  universeId?: string;
  worldId?: string;
  bookId?: string;
  removed?: CascadeCount;
}

/** A book edit re-renders /write; universe and world edits re-render /wiki. */
const SURFACE_OF: Record<StructureLevel, string> = {
  universe: "/wiki",
  world: "/wiki",
  book: "/write",
};

/**
 * Apply one structural edit to the universe -> world -> book skeleton.
 *
 * Creates mint their own ids and return them, so a caller can navigate onto what
 * it just made. Renames trim and treat a blank as a no-op (a whitespace-only
 * rename never blanks a name). Deletes enforce the last-child guard, then run the
 * cascade in one transaction. Every edit revalidates the surface that shows it.
 */
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
      // A fresh universe is minted with a world AND a book in one transaction, so
      // it always has a home for chapters. Its wiki starts EMPTY (no entry
      // carries the new universe_id).
      const ids = { universeId: randomUUID(), worldId: randomUUID(), bookId: randomUUID() };
      await createFreshUniverseRow({ ...ids, universeName: edit.name });
      return { ok: true, data: ids };
    }
    case "world": {
      // The book hangs off the world directly (W-6, no series), landed in one
      // transaction with a default research thread so the world is usable at once.
      const worldId = randomUUID();
      const bookId = randomUUID();
      await insertWorldRow({
        id: worldId,
        universeId: edit.universeId ?? DEFAULT_UNIVERSE_ID,
        title: edit.name,
        bookId,
      });
      return { ok: true, data: { worldId, bookId } };
    }
    case "book": {
      // Seed the first chapter atomically so the writer lands on a real "Chapter
      // One" row ready to type in, not a UI placeholder.
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
  // Each helper trims and treats a blank as a no-op.
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
  // The last-child guard, enforced where it cannot be bypassed. A universe has no
  // parent to be the last child of, so it is exempt.
  if (edit.level !== "universe") {
    const siblings = await countStructureSiblings(edit.level, edit.id);
    if (siblings <= 1) return { ok: false, error: LAST_CHILD_BLOCK[edit.level] };
  }
  const removed = await deleteCascade({ kind: edit.level, id: edit.id });
  return { ok: true, data: { removed } };
}

/**
 * ADVISORY: how many rows a delete would remove (the danger modal's preview).
 * Read-only, and it runs the SAME plan the delete runs, so the number the writer
 * is shown is the number that will be removed.
 */
export async function previewStructureDelete(input: {
  level: StructureLevel;
  id: string;
}): Promise<ActionResult<CascadeCount>> {
  return runAction("wiki.previewStructureDelete", async () => {
    const preview = await previewCascadeRows({ kind: input.level, id: input.id });
    return { ok: true, data: preview };
  });
}

// ---- Entity membership (TCK-023, W-4b) ------------------------------------
//
// Sharing an entity into a world is world MEMBERSHIP, not skeleton shape: it
// adds a world_entities junction row and no wiki content, so — like the edits
// above — it carries no confirmation token. Kept separate from
// `editWorldStructure` because it edits which entities a world holds, not which
// worlds exist.

/**
 * SHARE an existing entity into a world, so it appears in that world's gazetteer
 * as an additive member. Idempotent (ON CONFLICT DO NOTHING), so re-sharing is
 * harmless.
 */
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

/**
 * UNSHARE an entity from a world — drop ONLY that membership link. The entity row
 * and its other memberships survive; unlinking a non-member is a no-op.
 */
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
