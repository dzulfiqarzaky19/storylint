import type { Shelf } from "@/domain/types";
import { KIND_FOR_SHELF, KIND_LABEL } from "@/domain/types";
import { createEntry, editEntry, moveEntry, softDeleteEntry } from "@/server/actions/wiki/entries";
import { kindForNewEntry } from "../../lib/createEntryKind";
import { newId, type CommitContext, type IntentOf } from "./types";

export function commitEntry(intent: IntentOf<"entry">, ctx: CommitContext): void {
  const { state: s, write, worldId } = ctx;

  switch (intent.type) {
    case "entry.move": {
      const entry = s.byId[intent.entryId];
      if (!entry) return;
      if (intent.entryId === intent.beforeId) return;
      const fromShelf = entry.shelf as Shelf;

      const without = (shelf: Shelf) => s.order[shelf].filter((id) => id !== intent.entryId);
      const toOrder = without(intent.toShelf);
      const at = intent.beforeId ? toOrder.indexOf(intent.beforeId) : -1;
      if (at >= 0) toOrder.splice(at, 0, intent.entryId);
      else toOrder.push(intent.entryId);
      const fromOrder = fromShelf === intent.toShelf ? toOrder : without(fromShelf);

      return write(
        {
          type: "MOVE_ENTRY",
          entryId: intent.entryId,
          toShelf: intent.toShelf,
          beforeId: intent.beforeId,
        },
        "moveEntry",
        moveEntry({
          entryId: intent.entryId,
          toShelf: intent.toShelf,
          toShelfOrder: toOrder,
          fromShelf,
          fromShelfOrder: fromOrder,
        }),
      );
    }

    case "entry.create": {
      const kind = kindForNewEntry(intent.shelf, intent.categoryId);
      const name = `New ${KIND_LABEL[KIND_FOR_SHELF[intent.shelf]].toLowerCase()}`;
      const entryId = newId();
      return write(
        {
          type: "CREATE_ENTRY",
          entryId,
          kind,
          shelf: intent.shelf,
          name,
          note: "",
          summary: "",
          sortOrder: s.order[intent.shelf].length,
        },
        "createEntry",
        createEntry({ id: entryId, kind, shelf: intent.shelf, name, worldId }),
      );
    }

    case "entry.edit":
      return write(
        { type: "EDIT_ENTRY_FIELDS", entryId: intent.entryId, [intent.field]: intent.value },
        "editEntry",
        editEntry({ entryId: intent.entryId, [intent.field]: intent.value }),
      );

    case "entry.delete":
      return write(
        { type: "SOFT_DELETE_ENTRY", entryId: intent.entryId },
        "softDeleteEntry",
        softDeleteEntry({ id: intent.entryId }),
      );
  }
}
