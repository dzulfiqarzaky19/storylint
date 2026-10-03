"use client";

import { useCallback, useState, startTransition } from "react";
import { suggestEntryFacts } from "@/server/actions/wiki/aiSuggest";
import { clientErr } from "@/hooks/useServerAction";

export interface AiSuggestApi {
  suggestions: Record<string, { key: string; value: string }[]>;
  busy: boolean;
  suggest: (entryId: string) => void;
  remove: (entryId: string, key: string) => void;
}

export function useAiSuggest(onError: (message: string) => void): AiSuggestApi {
  const [suggestions, setSuggestions] = useState<
    Record<string, { key: string; value: string }[]>
  >({});
  const [busy, setBusy] = useState(false);

  const suggest = useCallback(
    (entryId: string) => {
      if (busy) return;
      setBusy(true);
      startTransition(() => {
        suggestEntryFacts({ entryId })
          .then((res) => {
            if (res.ok) {
              setSuggestions((prev) => ({ ...prev, [entryId]: res.data.facts }));
            } else {
              onError(res.error);
            }
          })
          .catch((err: unknown) => {
            onError(`suggestEntryFacts: ${clientErr(err)}`);
          })
          .finally(() => setBusy(false));
      });
    },
    [busy, onError],
  );

  const remove = useCallback((entryId: string, key: string) => {
    setSuggestions((prev) => ({
      ...prev,
      [entryId]: (prev[entryId] ?? []).filter((s) => s.key !== key),
    }));
  }, []);

  return { suggestions, busy, suggest, remove };
}
