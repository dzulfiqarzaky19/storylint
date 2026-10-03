import { createFact, deleteFact, editFact, moveFact } from "@/server/actions/wiki/entries";
import { newId, type CommitContext, type IntentOf } from "./types";

export function commitFact(intent: IntentOf<"fact">, ctx: CommitContext): void {
  const { state: s, write } = ctx;
  const nextFactOrder = (entryId: string) => s.byId[entryId]?.facts.length ?? 0;

  switch (intent.type) {
    case "fact.move":
      if (intent.fromEntryId === intent.toEntryId) return;
      if (!s.byId[intent.toEntryId]) return;
      return write(
        {
          type: "MOVE_FACT",
          factId: intent.factId,
          fromEntryId: intent.fromEntryId,
          toEntryId: intent.toEntryId,
        },
        "moveFact",
        moveFact({
          factId: intent.factId,
          toEntryId: intent.toEntryId,
          sortOrder: nextFactOrder(intent.toEntryId),
        }),
      );

    case "fact.create": {
      if (!s.byId[intent.entryId]) return;
      const factId = newId();
      const sortOrder = nextFactOrder(intent.entryId);
      return write(
        {
          type: "CREATE_FACT",
          entryId: intent.entryId,
          factId,
          key: intent.key,
          value: intent.value,
          sortOrder,
        },
        "createFact",
        createFact({
          id: factId,
          entryId: intent.entryId,
          key: intent.key,
          value: intent.value,
          sortOrder,
        }),
      );
    }

    case "fact.edit":
      return write(
        {
          type: "EDIT_FACT",
          entryId: intent.entryId,
          factId: intent.factId,
          [intent.field]: intent.value,
        },
        "editFact",
        editFact({ factId: intent.factId, [intent.field]: intent.value }),
      );

    case "fact.delete":
      return write(
        { type: "DELETE_FACT", entryId: intent.entryId, factId: intent.factId },
        "deleteFact",
        deleteFact({ factId: intent.factId }),
      );
  }
}
