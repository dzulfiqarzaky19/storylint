// =============================================================================
// Research store (HANDOFF §8) — useReducer state shape + action union + reducer.
//
// Reducer is the session source of truth; each action fires alongside its
// matching Server Action (src/lib/actions/research.ts). Pure reducer.
//
// Product rule 1 note: only CONFIRM_CARD corresponds to a wiki write, and only
// via the confirmed confirmCard server action. PROPOSE_CARD merely reveals the
// confirmation strip; CANCEL_PENDING writes nothing.
// =============================================================================

import type { ResearchTurnWithCards } from "../domain/types";

// ---- State ----------------------------------------------------------------

export interface ResearchState {
  question: string;
  /** Turns in order; hidden `more` turns become visible via ADVANCE_TURN. */
  turns: ResearchTurnWithCards[];
  /** Revealed turn ids (deferred `more` turns start hidden). */
  visibleTurnIds: string[];
  /** Proposition ids currently on the Kept board. */
  keptIds: string[];
  /** Proposition ids already written into the wiki (kept + confirmed). */
  inWikiIds: string[];
  /** The card pending confirmation ("Make it an entry"), or null. Reveals the strip. */
  pendingPropositionId: string | null;
  error: string | null;
}

// ---- Actions --------------------------------------------------------------
//
// action type      →  matching Server Action (actions/research.ts)
// ADVANCE_TURN     →  advanceTurn
// KEEP_CARD        →  keepCard
// PROPOSE_CARD     →  proposeCard        (reveals strip; no write)
// CONFIRM_CARD     →  confirmCard        (WIKI WRITE, confirmed)
// CANCEL_PENDING   →  cancelPending      (writes nothing)
// SET_ERROR        →  (none — surfaces a failed server action)

export type ResearchAction =
  | { type: "ADVANCE_TURN"; revealedTurnIds: string[] }
  | { type: "KEEP_CARD"; propositionId: string; kept: boolean }
  | { type: "PROPOSE_CARD"; propositionId: string }
  | { type: "CONFIRM_CARD"; propositionId: string; entryId: string }
  | { type: "CANCEL_PENDING" }
  // AI (session-only): append the writer's question and the AI's answer as two
  // new turns, both immediately visible. Cards are proposition-shaped so they
  // flow through the existing Keep / Make-it-an-entry paths. No wiki write.
  | { type: "APPEND_TURN"; turns: ResearchTurnWithCards[] }
  | { type: "SET_ERROR"; error: string | null };

// ---- Init -----------------------------------------------------------------

export function initResearchState(input: {
  question: string;
  turns: ResearchTurnWithCards[];
  /** Turn ids visible on first render (the non-deferred turns). */
  initialVisibleTurnIds: string[];
}): ResearchState {
  const keptIds: string[] = [];
  const inWikiIds: string[] = [];
  for (const turn of input.turns) {
    for (const card of turn.cards) {
      if (card.kept) keptIds.push(card.id);
      if (card.inWiki) inWikiIds.push(card.id);
    }
  }
  return {
    question: input.question,
    turns: input.turns,
    visibleTurnIds: input.initialVisibleTurnIds,
    keptIds,
    inWikiIds,
    pendingPropositionId: null,
    error: null,
  };
}

// ---- Reducer (pure) -------------------------------------------------------

export function researchReducer(state: ResearchState, action: ResearchAction): ResearchState {
  switch (action.type) {
    case "ADVANCE_TURN":
      return {
        ...state,
        visibleTurnIds: dedupe([...state.visibleTurnIds, ...action.revealedTurnIds]),
      };

    case "KEEP_CARD":
      return {
        ...state,
        keptIds: action.kept
          ? dedupe([...state.keptIds, action.propositionId])
          : state.keptIds.filter((id) => id !== action.propositionId),
      };

    case "PROPOSE_CARD":
      return { ...state, pendingPropositionId: action.propositionId };

    case "CONFIRM_CARD":
      // The confirmed wiki write happened server-side; reflect it locally.
      return {
        ...state,
        inWikiIds: dedupe([...state.inWikiIds, action.propositionId]),
        keptIds: dedupe([...state.keptIds, action.propositionId]),
        pendingPropositionId:
          state.pendingPropositionId === action.propositionId ? null : state.pendingPropositionId,
      };

    case "CANCEL_PENDING":
      return { ...state, pendingPropositionId: null };

    case "APPEND_TURN": {
      const newKept: string[] = [];
      const newInWiki: string[] = [];
      for (const turn of action.turns) {
        for (const card of turn.cards) {
          if (card.kept) newKept.push(card.id);
          if (card.inWiki) newInWiki.push(card.id);
        }
      }
      return {
        ...state,
        turns: [...state.turns, ...action.turns],
        visibleTurnIds: dedupe([
          ...state.visibleTurnIds,
          ...action.turns.map((t) => t.id),
        ]),
        keptIds: dedupe([...state.keptIds, ...newKept]),
        inWikiIds: dedupe([...state.inWikiIds, ...newInWiki]),
        error: null,
      };
    }

    case "SET_ERROR":
      return { ...state, error: action.error };

    default:
      return assertNever(action);
  }
}

// ---- Helpers --------------------------------------------------------------

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

function assertNever(x: never): never {
  throw new Error(`researchReducer: unhandled action ${JSON.stringify(x)}`);
}
