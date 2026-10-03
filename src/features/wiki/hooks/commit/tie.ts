import type { Kind, Shelf } from "@/domain/types";
import { KIND_FOR_SHELF } from "@/domain/types";
import { createEntryTied, linkEntry, untie } from "@/server/actions/wiki/entries";
import { LINKED_REL, newId, type CommitContext, type IntentOf } from "./types";

/** Ties always start from the entry that is currently selected. */
export function commitTie(intent: IntentOf<"tie">, ctx: CommitContext): void {
  const { state: s, write, worldId } = ctx;
  const selected = s.selectedEntryId ? s.byId[s.selectedEntryId] : undefined;
  if (!selected) return;

  switch (intent.type) {
    case "tie.link": {
      if (intent.toEntryId === selected.id) return;
      const tieId = newId();
      const rel = intent.rel?.trim() || LINKED_REL;
      return write(
        { type: "LINK_ENTRY", tieId, fromEntryId: selected.id, toEntryId: intent.toEntryId, rel },
        "linkEntry",
        linkEntry({ id: tieId, fromEntryId: selected.id, toEntryId: intent.toEntryId, rel }),
      );
    }

    case "tie.untie":
      return write(
        { type: "UNTIE", fromEntryId: selected.id, tieId: intent.tieId },
        "untie",
        untie({ tieId: intent.tieId }),
      );

    case "tie.createEntry": {
      const name = intent.name.trim();
      if (!name) return;
      const shelf = selected.shelf as Shelf;
      const kind: Kind = KIND_FOR_SHELF[shelf];
      const entryId = newId();
      const tieId = newId();
      const rel = intent.rel?.trim() || LINKED_REL;
      return write(
        { type: "CREATE_TIED", entryId, tieId, kind, shelf, name, toEntryId: selected.id, rel },
        "createEntryTied",
        createEntryTied({
          entryId,
          tieId,
          name,
          kind,
          shelf,
          toEntryId: selected.id,
          rel,
          confirmed: true,
          worldId,
        }),
      );
    }
  }
}
