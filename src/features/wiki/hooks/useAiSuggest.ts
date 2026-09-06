"use client";

import { useCallback, useState, startTransition } from "react";
import { suggestEntryFacts } from "@/lib/actions/wiki";
import { clientErr } from "@/components/hooks/useServerAction";

export interface AiSuggestApi {
  /** Suggested facts per entry id, awaiting accept/dismiss. */
  suggestions: Record<string, { key: string; value: string }[]>;
  /** True while a suggest call is in flight (one at a time). */
  busy: boolean;
  /** Ask the model for candidate facts on this entry (read-only). */
  suggest: (entryId: string) => void;
  /** Drop one suggestion from the panel (after it is accepted elsewhere). */
  remove: (entryId: string, key: string) => void;
}

/**
 * AI fact-suggestion side-feature for /wiki, lifted out of Wiki (T-ARCH-13).
 * READ-ONLY: it only fetches candidate facts and holds them panel-local; turning
 * a suggestion into a real fact is the CALLER's job (via the confirmation-gated
 * createFact path), so this hook never writes. `onError` surfaces a failed fetch.
 */
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
