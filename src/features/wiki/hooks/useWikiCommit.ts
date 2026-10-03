"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Dispatch } from "react";
import { useServerAction } from "@/hooks/useServerAction";
import type { WikiAction, WikiState } from "@/features/wiki/state";
import type { CommitContext, WikiIntent } from "./commit/types";
import { commitEntry } from "./commit/entry";
import { commitFact } from "./commit/fact";
import { commitTie } from "./commit/tie";
import { commitSuggestion } from "./commit/suggestion";
import { commitCategory } from "./commit/category";

export type { WikiIntent } from "./commit/types";
export type WikiCommit = (intent: WikiIntent) => void;

/**
 * The only way a wiki screen changes the gazetteer: it states an intent, and
 * the handler for that noun updates the store and the database together.
 */
export function useWikiCommit(args: {
  state: WikiState;
  dispatch: Dispatch<WikiAction>;
  worldId: string;
}): WikiCommit {
  const { state, dispatch, worldId } = args;

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const surfaceError = useCallback(
    (error: string) => dispatch({ type: "SET_ERROR", error }),
    [dispatch],
  );
  const { run } = useServerAction(surfaceError);

  return useCallback(
    (intent: WikiIntent) => {
      const ctx: CommitContext = {
        state: stateRef.current,
        worldId,
        dispatch,
        surfaceError,
        write: (action, label, call) => {
          dispatch(action);
          run(call, { label });
        },
      };

      switch (intent.type) {
        case "entry.move":
        case "entry.create":
        case "entry.edit":
        case "entry.delete":
          return commitEntry(intent, ctx);
        case "fact.move":
        case "fact.create":
        case "fact.edit":
        case "fact.delete":
          return commitFact(intent, ctx);
        case "tie.link":
        case "tie.untie":
        case "tie.createEntry":
          return commitTie(intent, ctx);
        case "suggestion.write":
        case "suggestion.dismiss":
          return commitSuggestion(intent, ctx);
        case "category.create":
        case "category.rename":
        case "category.reset":
        case "category.delete":
          return commitCategory(intent, ctx);
      }
    },
    [dispatch, run, surfaceError, worldId],
  );
}
