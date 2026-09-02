"use server";

// ============================================================================
// World-structure server actions (universe / world / book)
// Split out of the former monolithic wiki.ts (T-ARCH-7). Product rule 1 and the
// runAction envelope are unchanged; only file boundaries moved.
// ============================================================================

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type ActionResult, runAction } from "../confirmation";
import {
  type CascadePreview,
  previewBookCascade,
  previewUniverseCascade,
  previewWorldCascade,
} from "../../db/queries";
import {
  linkEntityToWorld as linkEntityToWorldRow,
  unlinkEntityFromWorld as unlinkEntityFromWorldRow,
} from "../../db/gazetteer-mutations";
import {
  type CascadeCount,
  createFreshUniverse as createFreshUniverseRow,
  deleteBookCascade,
  deleteUniverseCascade,
  deleteWorldCascade,
  insertBookWithFirstChapter,
  insertWorld as insertWorldRow,
  renameBook as renameBookRow,
  renameUniverse as renameUniverseRow,
  renameWorld as renameWorldRow,
} from "../../db/mutations";
import { DEFAULT_UNIVERSE_ID } from "../../db/scope";

/**
 * CONTINUATION: add a new book under an existing WORLD (W-6: books.world_id;
 * reuses that world's universe canon by construction). Structural — no wiki token.
 */
export async function createBook(input: {
  name: string;
  worldId: string;
  sortOrder?: number;
}): Promise<ActionResult<{ bookId: string }>> {
  return runAction("wiki.createBook", async () => {
    const id = randomUUID();
    // A user-created book seeds its first chapter atomically so the writer lands
    // on a real "Chapter One" row (persisted, not a UI placeholder) ready to type
    // in. insertBookWithFirstChapter rolls back the book if the chapter fails.
    await insertBookWithFirstChapter({
      id,
      name: input.name,
      worldId: input.worldId,
      sortOrder: input.sortOrder,
      firstChapterId: randomUUID(),
      firstChapterTitle: "Chapter One",
      firstChapterBody: { type: "doc", content: [{ type: "paragraph" }] },
    });
    return { ok: true, data: { bookId: id } };
  });
}

/**
 * FRESH world: a NEW universe with its first world + first book, in one
 * transaction. The new universe's wiki starts EMPTY (no entries carry its
 * universe_id). W-6: mints universe + world + book (series is gone). Structural —
 * no wiki token.
 */
export async function createUniverse(input: {
  universeName: string;
  worldName?: string;
  bookName?: string;
}): Promise<ActionResult<{ universeId: string; worldId: string; bookId: string }>> {
  return runAction("wiki.createUniverse", async () => {
    const universeId = randomUUID();
    const worldId = randomUUID();
    const bookId = randomUUID();
    await createFreshUniverseRow({
      universeId,
      worldId,
      bookId,
      universeName: input.universeName,
      worldName: input.worldName,
      bookName: input.bookName,
    });
    return { ok: true, data: { universeId, worldId, bookId } };
  });
}

/**
 * TCK-022 (W-4a): create a SECOND (or Nth) world inside an EXISTING universe (the
 * `+ world` affordance on the World switcher). Mints the world/book ids and calls
 * insertWorld, which lands them in one transaction so the new world always has a
 * home for chapters and one default research thread (R2). W-6: the book hangs off
 * the world directly, no series.
 * Defaults to the active universe when none is passed. Structural — no wiki token.
 */
export async function createWorld(input: {
  worldName: string;
  universeId?: string;
}): Promise<ActionResult<{ worldId: string }>> {
  return runAction("wiki.createWorld", async () => {
    const worldId = randomUUID();
    const bookId = randomUUID();
    await insertWorldRow({
      id: worldId,
      universeId: input.universeId ?? DEFAULT_UNIVERSE_ID,
      title: input.worldName,
      bookId,
    });
    return { ok: true, data: { worldId } };
  });
}

/**
 * Rename a world (the manage-screen Rename affordance). Structural — no wiki
 * token. The DB helper trims and treats a blank as a no-op, so a whitespace-only
 * rename never blanks the world's name. Revalidates /wiki so the switcher and
 * every world-scoped view re-render with the new title.
 */
export async function renameWorld(input: {
  worldId: string;
  title: string;
}): Promise<ActionResult> {
  return runAction("wiki.renameWorld", async () => {
    await renameWorldRow({ id: input.worldId, title: input.title });
    revalidatePath("/wiki");
    return { ok: true, data: undefined };
  });
}

/**
 * Rename a universe (the manage-screen Rename affordance). Structural — no wiki
 * token. Same trim + blank-is-no-op contract as renameWorld. Revalidates /wiki.
 */
export async function renameUniverse(input: {
  universeId: string;
  name: string;
}): Promise<ActionResult> {
  return runAction("wiki.renameUniverse", async () => {
    await renameUniverseRow({ id: input.universeId, name: input.name });
    revalidatePath("/wiki");
    return { ok: true, data: undefined };
  });
}

/**
 * T-SCOPE-2: rename a BOOK (the /write book dropdown Rename affordance).
 * Structural — no wiki token. Same trim + blank-is-no-op contract as
 * renameWorld/renameUniverse. Revalidates /write so the book pill + chapter list
 * re-render with the new name.
 */
export async function renameBook(input: {
  bookId: string;
  name: string;
}): Promise<ActionResult> {
  return runAction("wiki.renameBook", async () => {
    await renameBookRow({ id: input.bookId, name: input.name });
    revalidatePath("/write");
    return { ok: true, data: undefined };
  });
}

/**
 * TCK-023 (W-4b): SHARE an existing entity into a world — link it so it appears
 * in that world's gazetteer as an additive member. Idempotent (the DB helper's
 * ON CONFLICT DO NOTHING), so re-sharing is harmless. Structural — no wiki token
 * (mirrors createWorld). Revalidates /wiki so the server re-renders the target
 * world's snapshot with the newly-linked entity.
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
 * TCK-023 (W-4b): UNSHARE an entity from a world — drop ONLY that membership link.
 * The entity row and its home-world membership survive (orphan = LEAVE); unlink of
 * a non-member is a no-op. Structural — no wiki token. Revalidates /wiki so the
 * world's snapshot re-renders without the unlinked entity.
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

/**
 * DANGER: delete a universe and its ENTIRE subtree (worlds' books, chapters,
 * entries, canon + book-scoped facts/ties/facets, appearances, open questions,
 * research threads). Gated on `confirmed: true`. Returns the authoritative
 * CascadeCount (total === rows removed).
 */
export async function deleteUniverse(input: {
  universeId: string;
  confirmed: true;
}): Promise<ActionResult<CascadeCount>> {
  return runAction("wiki.deleteUniverse", async () => {
    if (input.confirmed !== true) {
      return { ok: false, error: "wiki.deleteUniverse: not confirmed" };
    }
    const count = await deleteUniverseCascade(input.universeId);
    return { ok: true, data: count };
  });
}

/**
 * DANGER: delete a single book and its book-scoped content (chapters,
 * appearances, book-scoped facts/ties/facets). NULL-canon rows, sibling books,
 * and entries SURVIVE. Gated on `confirmed: true`. Returns the CascadeCount.
 */
export async function deleteBook(input: {
  bookId: string;
  confirmed: true;
}): Promise<ActionResult<CascadeCount>> {
  return runAction("wiki.deleteBook", async () => {
    if (input.confirmed !== true) {
      return { ok: false, error: "wiki.deleteBook: not confirmed" };
    }
    const count = await deleteBookCascade(input.bookId);
    return { ok: true, data: count };
  });
}

/**
 * DANGER: delete a WORLD and its world-owned data WITHOUT destroying entities or
 * universe-canon (orphan=LEAVE). Unlinks the world's world_entities membership
 * (the entity ROWS survive, reclaimable), drops the world's user categories
 * (built-ins are global and survive), and removes the world row. Sibling worlds,
 * books (universe-owned), and entries SURVIVE. Gated on `confirmed: true`.
 * Returns the CascadeCount (total === rows removed). The CALLER must never delete
 * a universe's LAST world (that would orphan every shared entity with no world to
 * reclaim it in); the WorldSwitcher disables the affordance in that case.
 */
export async function deleteWorld(input: {
  worldId: string;
  confirmed: true;
}): Promise<ActionResult<CascadeCount>> {
  return runAction("wiki.deleteWorld", async () => {
    if (input.confirmed !== true) {
      return { ok: false, error: "wiki.deleteWorld: not confirmed" };
    }
    const count = await deleteWorldCascade(input.worldId);
    return { ok: true, data: count };
  });
}

/**
 * ADVISORY: how many rows a delete would remove (the danger modal's preview).
 * Read-only; the authoritative count is still the delete action's return. The S5
 * gate asserts preview.total === delete count === rows actually removed.
 */
export async function previewCascade(input: {
  level: "universe" | "book" | "world";
  id: string;
}): Promise<ActionResult<CascadePreview>> {
  return runAction("wiki.previewCascade", async () => {
    const preview =
      input.level === "universe"
        ? await previewUniverseCascade(input.id)
        : input.level === "book"
          ? await previewBookCascade(input.id)
          : await previewWorldCascade(input.id);
    return { ok: true, data: preview };
  });
}
