"use client";

import { useCallback } from "react";
import type { Dispatch } from "react";
import { useServerAction } from "@/hooks/useServerAction";
import type { ActionResult } from "@/domain/result";
import { keepCard, proposeCard, cancelPending } from "@/server/actions/research/cards";
import { writeConfirmedTarget } from "@/server/actions/wiki/writeConfirmedTarget";
import type { ResearchAction } from "@/features/research/state/researchStore";
import {
  planResearchWrite,
  type ResearchIntent,
  type ResearchPersist,
} from "../lib/researchWrite";

export type { ResearchIntent };
export type ResearchCommit = (intent: ResearchIntent) => void;

function persist(plan: ResearchPersist): Promise<ActionResult<unknown>> {
  switch (plan.kind) {
    case "keep":
      return keepCard(plan.propositionId, plan.kept);
    case "propose":
      return proposeCard(plan.propositionId);
    case "cancel":
      return cancelPending();
    case "confirm":
      return writeConfirmedTarget({
        result: plan.result,
        origin: plan.origin,
        worldId: plan.worldId,
        confirmed: plan.confirmed,
      });
  }
}

export function useResearchCommit(args: {
  dispatch: Dispatch<ResearchAction>;
  worldId: string;
}): ResearchCommit {
  const { dispatch, worldId } = args;
  const surfaceError = useCallback(
    (error: string) => dispatch({ type: "SET_ERROR", error }),
    [dispatch],
  );
  const { run } = useServerAction(surfaceError);

  return useCallback(
    (intent: ResearchIntent) => {
      const plan = planResearchWrite(intent, worldId);
      dispatch(plan.action);
      run(persist(plan.persist));
    },
    [dispatch, run, worldId],
  );
}
