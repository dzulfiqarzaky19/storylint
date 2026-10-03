"use server";

import { randomUUID } from "node:crypto";
import { type CategoryRow, type Shelf } from "@/domain/types";
import { type ActionResult, confirmWikiWrite, runAction } from "@/domain/result";
import { getCategories as getCategoriesRow } from "@/server/db/gazetteer/reads";
import { createCategory as createCategoryRow, deleteCategory as deleteCategoryRow, getMaxCategorySortOrder, renameCategory as renameCategoryRow, resetCategoryLabel as resetCategoryLabelRow } from "@/server/db/gazetteer/mutations/categories";

export async function getCategories(): Promise<ActionResult<CategoryRow[]>> {
  return runAction("wiki.getCategories", async () => {
    const categories = await getCategoriesRow();
    return { ok: true, data: categories };
  });
}

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

export async function renameCategory(input: {
  kind: string;
  label: string;
}): Promise<ActionResult> {
  return runAction("wiki.renameCategory", async () => {
    await renameCategoryRow({ kind: input.kind, label: input.label });
    return { ok: true, data: undefined };
  });
}

export async function resetCategoryLabel(input: {
  kind: string;
}): Promise<ActionResult> {
  return runAction("wiki.resetCategoryLabel", async () => {
    await resetCategoryLabelRow(input.kind);
    return { ok: true, data: undefined };
  });
}

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

