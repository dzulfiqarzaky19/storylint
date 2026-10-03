import { startTransition } from "react";
import { clientErr } from "@/hooks/useServerAction";
import { defaultCategoryShelf } from "@/domain/wiki/categoryLabels";
import {
  createCategory,
  deleteCategory,
  renameCategory,
  resetCategoryLabel,
} from "@/server/actions/wiki/categories";
import type { CommitContext, IntentOf } from "./types";

export function commitCategory(intent: IntentOf<"category">, ctx: CommitContext): void {
  const { write, dispatch, surfaceError } = ctx;

  switch (intent.type) {
    // Not optimistic: the server decides the new category's sort order, so the
    // row joins the store only once the server has returned it.
    case "category.create": {
      const label = intent.label.trim();
      if (label === "") return;
      startTransition(() => {
        createCategory({ id: intent.id, label, shelf: defaultCategoryShelf() })
          .then((res) => {
            if (res.ok) dispatch({ type: "CREATE_CATEGORY", category: res.data });
            else surfaceError(res.error);
          })
          .catch((err: unknown) => {
            surfaceError(`createCategory: ${clientErr(err)}`);
          });
      });
      return;
    }

    case "category.rename":
      return write(
        { type: "RENAME_CATEGORY", kind: intent.categoryId, label: intent.label },
        "renameCategory",
        renameCategory({ kind: intent.categoryId, label: intent.label }),
      );

    case "category.reset":
      return write(
        { type: "RESET_CATEGORY", kind: intent.categoryId },
        "resetCategoryLabel",
        resetCategoryLabel({ kind: intent.categoryId }),
      );

    case "category.delete":
      return write(
        { type: "DELETE_CATEGORY", kind: intent.categoryId },
        "deleteCategory",
        deleteCategory({ kind: intent.categoryId, confirmed: true }),
      );
  }
}
