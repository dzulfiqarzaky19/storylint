import type { ResearchTurnWithCards } from "@/domain/types";

export interface ResearchState {
  question: string;
  turns: ResearchTurnWithCards[];
  visibleTurnIds: string[];
  keptIds: string[];
  inWikiIds: string[];
  pendingPropositionId: string | null;
  error: string | null;
}

export type ResearchAction =
  | { type: "KEEP_CARD"; propositionId: string; kept: boolean }
  | { type: "PROPOSE_CARD"; propositionId: string }
  | { type: "CONFIRM_CARD"; propositionId: string }
  | { type: "CANCEL_PENDING" }
  | { type: "APPEND_TURN"; turns: ResearchTurnWithCards[] }
  | { type: "APPEND_STREAMING_TURN"; turns: ResearchTurnWithCards[] }
  | { type: "STREAM_DELTA"; turnId: string; text: string }
  | { type: "RECONCILE_TURN"; tempTurnId: string; turn: ResearchTurnWithCards }
  | { type: "ROLLBACK_STREAMING_TURN"; turnIds: string[] }
  | { type: "SET_ERROR"; error: string | null };

export function initResearchState(input: {
  question: string;
  turns: ResearchTurnWithCards[];
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

export function researchReducer(state: ResearchState, action: ResearchAction): ResearchState {
  switch (action.type) {
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

    case "APPEND_STREAMING_TURN": {
      return {
        ...state,
        turns: [...state.turns, ...action.turns],
        visibleTurnIds: dedupe([
          ...state.visibleTurnIds,
          ...action.turns.map((t) => t.id),
        ]),
        error: null,
      };
    }

    case "STREAM_DELTA":
      return {
        ...state,
        turns: state.turns.map((t) =>
          t.id === action.turnId ? { ...t, text: t.text + action.text } : t,
        ),
      };

    case "RECONCILE_TURN": {
      const persisted = action.turn;
      const newKept: string[] = [];
      const newInWiki: string[] = [];
      for (const card of persisted.cards) {
        if (card.kept) newKept.push(card.id);
        if (card.inWiki) newInWiki.push(card.id);
      }
      return {
        ...state,
        turns: state.turns.map((t) => (t.id === action.tempTurnId ? persisted : t)),
        visibleTurnIds: dedupe(
          state.visibleTurnIds.map((id) => (id === action.tempTurnId ? persisted.id : id)),
        ),
        keptIds: dedupe([...state.keptIds, ...newKept]),
        inWikiIds: dedupe([...state.inWikiIds, ...newInWiki]),
      };
    }

    case "ROLLBACK_STREAMING_TURN": {
      const drop = new Set(action.turnIds);
      return {
        ...state,
        turns: state.turns.filter((t) => !drop.has(t.id)),
        visibleTurnIds: state.visibleTurnIds.filter((id) => !drop.has(id)),
      };
    }

    case "SET_ERROR":
      return { ...state, error: action.error };

    default:
      return assertNever(action);
  }
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

function assertNever(x: never): never {
  throw new Error(`researchReducer: unhandled action ${JSON.stringify(x)}`);
}
