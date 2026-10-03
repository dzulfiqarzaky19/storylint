import { addSuggestionAsFact, dismissSuggestion } from "@/server/actions/wiki/entries";
import { newId, type CommitContext, type IntentOf } from "./types";

export function commitSuggestion(intent: IntentOf<"suggestion">, ctx: CommitContext): void {
  const { state: s, write, worldId } = ctx;

  switch (intent.type) {
    case "suggestion.write": {
      const sug = intent.suggestion;
      const entry =
        s.byId[sug.entryId] ?? (s.selectedEntryId ? s.byId[s.selectedEntryId] : undefined);
      if (!entry) return;
      const factId = newId();
      const sortOrder = entry.facts.length;
      return write(
        {
          type: "ADD_SUGGESTION_AS_FACT",
          suggestionKey: sug.suggestionKey,
          entryId: entry.id,
          factId,
          key: sug.key,
          value: sug.value,
          sortOrder,
        },
        "addSuggestionAsFact",
        addSuggestionAsFact({
          factId,
          suggestionKey: sug.suggestionKey,
          worldId,
          entryId: entry.id,
          key: sug.key,
          value: sug.value,
          sortOrder,
          confirmed: true,
        }),
      );
    }

    case "suggestion.dismiss":
      return write(
        { type: "DISMISS_SUGGESTION", suggestionKey: intent.suggestionKey },
        "dismissSuggestion",
        dismissSuggestion({ worldId, suggestionKey: intent.suggestionKey }),
      );
  }
}
