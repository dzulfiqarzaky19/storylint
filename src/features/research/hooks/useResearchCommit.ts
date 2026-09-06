"use client";

// =============================================================================
// The research card write-through — ONE module.
//
// WHY: every card mutation used to be TWO calls the screen had to keep in
// agreement — an optimistic `dispatch(ResearchAction)` and a matching Server
// Action — plus two facts the caller had to supply correctly per call site:
//
// 1. THE PAIRING. KEEP_CARD ↔ keepCard, PROPOSE_CARD ↔ proposeCard,
// CONFIRM_CARD ↔ writeConfirmedTarget, CANCEL_PENDING ↔ cancelPending. A
// mismatch (the live wiki bug this shape already caused on /wiki) writes the
// session and the database apart.
// 2. THE CONFIRMATION FLAG. Confirm is the wiki-write gate (product rule 1).
// The screen spelled `confirmed: true`, built `{ from: "card", propositionId }`,
// and threaded `worldId` at the call site — the same facts
// `writeConfirmedTarget` already owns.
//
// Two of the four "paired" server actions persist nothing (`proposeCard`,
// `cancelPending`). The screen still had to fire them to keep the ritual
// uniform. That is caller knowledge of a no-op.
//
// This module hides all of it. A caller states an INTENT in the domain's own
// nouns — "keep this card", "open the picker", "write what the picker
// confirmed" — and learns nothing about pairing, confirmation, or the
// origin/worldId envelope. The store, the server actions, and the error sink
// are composed INSIDE. The only thing that crosses the seam is `commit(intent)`.
// =============================================================================

import { useCallback } from "react";
import type { Dispatch } from "react";
import { useServerAction } from "@/components/hooks/useServerAction";
import type { ActionResult } from "@/lib/actions/confirmation";
import { keepCard, proposeCard, cancelPending } from "@/lib/actions/research";
import { writeConfirmedTarget } from "@/lib/actions/wiki";
import type { ResearchAction } from "@/lib/state/researchStore";
import {
  planResearchWrite,
  type ResearchIntent,
  type ResearchPersist,
} from "../lib/researchWrite";

export type { ResearchIntent };
/** The whole write-through, as one call. Fire-and-forget; failures surface. */
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
