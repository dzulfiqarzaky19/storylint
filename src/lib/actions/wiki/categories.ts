"use server";

// ============================================================================
// Wiki category server actions
// Split out of the former monolithic wiki.ts (T-ARCH-7). Product rule 1 and the
// runAction envelope are unchanged; only file boundaries moved.
// ============================================================================

import { randomUUID } from "node:crypto";
import { type CategoryRow, type Shelf } from "../../domain/types";
import { type ActionResult, confirmWikiWrite, runAction } from "../confirmation";
import { getCategories as getCategoriesRow } from "../../db/gazetteer";
import {
  createCategory as createCategoryRow,
  deleteCategory as deleteCategoryRow,
  getMaxCategorySortOrder,
  renameCategory as renameCategoryRow,
  resetCategoryLabel as resetCategoryLabelRow,
} from "../../db/gazetteer-mutations";

/**
 * List every live category (built-in + user), ordered for the shelf headers.
 * Pure read, no confirmation token. Mirrors the snapshot's category ordering.
 */
export async function getCategories(): Promise<ActionResult<CategoryRow[]>> {
  return runAction("wiki.getCategories", async () => {
    const categories = await getCategoriesRow();
    return { ok: true, data: categories };
  });
}

/**
 * Create a new user category on a shelf. Uses the caller-supplied `id` when
 * given (the client generates it ONCE so a React-18 double-fired transition is
 * idempotent — the DB INSERT has ON CONFLICT (id) DO NOTHING), else generates a
 * fresh UUID. Built-ins keep the legacy enum-string ids; user categories are
 * UUIDs. Appends it after every
 * existing category (max sort_order + 1), and stores the trimmed label. NOT a
 * wiki-content write (an empty category holds no wiki knowledge), so no
 * confirmation token. A blank label is rejected by the mutation. Returns the
 * created row.
 */
export async function createCategory(input: {
  id?: string;
  label: string;
  shelf: Shelf;
}): Promise<ActionResult<CategoryRow>> {
  return runAction("wiki.createCategory", async () => {
    const id = input.id ?? randomUUID();
    const sortOrder = await getMaxCategorySortOrder();
    const category = await createCategoryRow({
      id,
      label: input.label,
      shelf: input.shelf,
      sortOrder,
    });
    return { ok: true, data: category };
  });
}

/**
 * Rename a category header (e.g. "People" -> "Cast"). Updates the category row's
 * label. NOT a wiki-content write (a category holds no wiki knowledge), so
 * product rule 1 does not apply and no confirmation token is required. The
 * mutation trims and treats a blank label as a no-op. Mirrors reducer
 * `RENAME_CATEGORY`.
 */
export async function renameCategory(input: {
  kind: string;
  label: string;
}): Promise<ActionResult> {
  return runAction("wiki.renameCategory", async () => {
    await renameCategoryRow({ kind: input.kind, label: input.label });
    return { ok: true, data: undefined };
  });
}

/**
 * Reset a category header back to its shelf default (built-in only; a user
 * category has no default, so it is a no-op). Idempotent. No confirmation token
 * (not a wiki-content write). Mirrors reducer `RESET_CATEGORY`.
 */
export async function resetCategoryLabel(input: {
  kind: string;
}): Promise<ActionResult> {
  return runAction("wiki.resetCategoryLabel", async () => {
    await resetCategoryLabelRow(input.kind);
    return { ok: true, data: undefined };
  });
}

/**
 * WIKI WRITE (product rule 1). Delete a whole category: bulk soft-delete EVERY
 * live entry of the category (their rows survive, so inbound ties render as
 * tombstones). Irreversible from the UI, so it REQUIRES an explicit confirmation
 * and is gated behind a danger confirm dialog in the caller. Returns the number
 * of entries soft-deleted. Mirrors reducer `DELETE_CATEGORY`.
 *
 * @param input.confirmed must be the literal `true` — the confirmation gate.
 */
export async function deleteCategory(input: {
  kind: string;
  confirmed: true;
}): Promise<ActionResult<{ deleted: number }>> {
  return runAction("wiki.deleteCategory", async () => {
    const confirmation = confirmWikiWrite({ confirmed: input.confirmed });
    const deleted = await deleteCategoryRow(
      { kind: input.kind, deletedAt: Date.now() },
      confirmation,
    );
    return { ok: true, data: { deleted } };
  });
}

// ---- Trash: restore + purge (F6-S6) ---------------------------------------
