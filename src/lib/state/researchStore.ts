// =============================================================================
// Research store — useReducer state shape + action union + reducer.
//
// Reducer is the session source of truth; each action fires alongside its
// matching persist through commit(intent) (planResearchWrite). Pure reducer.
//
// Product rule 1 note: only CONFIRM_CARD corresponds to a wiki write, and only
// via the confirmed writeConfirmedTarget server action. PROPOSE_CARD merely reveals the
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
// KEEP_CARD        →  keepCard
// PROPOSE_CARD     →  proposeCard        (reveals strip; no write)
// CONFIRM_CARD     →  writeConfirmedTarget (WIKI WRITE, confirmed)
// CANCEL_PENDING   →  cancelPending      (writes nothing)
// SET_ERROR        →  (none — surfaces a failed server action)

export type ResearchAction =
  | { type: "KEEP_CARD"; propositionId: string; kept: boolean }
  | { type: "PROPOSE_CARD"; propositionId: string }
  | { type: "CONFIRM_CARD"; propositionId: string }
  | { type: "CANCEL_PENDING" }
  // AI (session-only): append the writer's question and the AI's answer as two
  // new turns, both immediately visible. Cards are proposition-shaped so they
  // flow through the existing Keep / Make-it-an-entry paths. No wiki write.
  | { type: "APPEND_TURN"; turns: ResearchTurnWithCards[] }
  // AI streaming (F2b, session-only): open a placeholder answer turn, grow it
  // as text arrives, then reconcile it with the server-persisted turn on
  // stream-complete. Persistence itself happens server-side; these actions only
  // reflect it in session state. The reducer stays the sole owner of `turns`.
  //
  // APPEND_STREAMING_TURN   → the question turn + an empty answer placeholder
  // STREAM_DELTA            → append a chunk of text to the placeholder answer
  // RECONCILE_TURN          → swap the placeholder for the persisted answer turn
  // ROLLBACK_STREAMING_TURN → drop the placeholders when the stream failed or was
  //                           aborted (server persisted nothing, so neither turn
  //                           may linger in session state)
  | { type: "APPEND_STREAMING_TURN"; turns: ResearchTurnWithCards[] }
  | { type: "STREAM_DELTA"; turnId: string; text: string }
  | { type: "RECONCILE_TURN"; tempTurnId: string; turn: ResearchTurnWithCards }
  | { type: "ROLLBACK_STREAMING_TURN"; turnIds: string[] }
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

    case "APPEND_STREAMING_TURN": {
      // Same shape as APPEND_TURN: append the question + an empty answer
      // placeholder and reveal both. The placeholder's text grows via
      // STREAM_DELTA; its cards arrive at RECONCILE_TURN. Clears any prior error.
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
      // Append the incoming chunk to the matching turn's text; all other turns
      // are untouched. Immutable update so React re-renders the growing answer.
      return {
        ...state,
        turns: state.turns.map((t) =>
          t.id === action.turnId ? { ...t, text: t.text + action.text } : t,
        ),
      };

    case "RECONCILE_TURN": {
      // Swap the placeholder answer turn for the server-persisted one (real id,
      // ordinal, and cards). visibleTurnIds carries the placeholder id, so remap
      // it to the persisted id; fold the persisted cards' kept/inWiki flags in.
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
      // The stream failed / was aborted: the server persisted nothing, so the
      // placeholder turn(s) must not linger. Remove them from turns and from the
      // visible set. Cards never reached the boards (RECONCILE_TURN never ran),
      // so keptIds / inWikiIds need no cleanup.
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

// ---- Helpers --------------------------------------------------------------

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

function assertNever(x: never): never {
  throw new Error(`researchReducer: unhandled action ${JSON.stringify(x)}`);
}
