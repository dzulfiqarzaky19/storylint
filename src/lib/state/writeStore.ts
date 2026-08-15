// =============================================================================
// Write store — useReducer state shape + action union + reducer.
//
// Reducer is the session source of truth; each action fires alongside its
// matching Server Action (src/lib/actions/write.ts). Pure reducer.
//
// Product rule 1 note: no action here writes the wiki. A 'wiki' mark resolution
// routes into the confirmed wiki path (see write.ts resolveMark) rather than
// mutating the wiki from this store.
// =============================================================================

import type { Mark } from "../check";

// ---- State ----------------------------------------------------------------

export interface WriteState {
  chapterNumber: number;
  /** ProseMirror document JSON (opaque to the reducer). */
  body: unknown;
  /** Live marks from the check engine, in document order. */
  marks: Mark[];
  /** The single open mark (rail row == underline click), or null. */
  openMarkKey: string | null;
  /** markKeys resolved via 'leave' this session (suppressed). */
  resolvedMarkKeys: string[];
  /** Dirty since last successful save? Drives the save indicator. */
  dirty: boolean;
  /** Last save/resolve error, surfaced not swallowed (§8). */
  error: string | null;
}

// ---- Actions --------------------------------------------------------------
//
// action type       →  matching Server Action (actions/write.ts)
// EDIT_BODY          →  (local; triggers debounced-free per-edit SAVE_MANUSCRIPT)
// SET_MARKS          →  (none; check engine output pushed in)
// SAVE_MANUSCRIPT    →  saveManuscript
// SAVE_SUCCEEDED     →  (none; clears dirty after saveManuscript resolves)
// OPEN_MARK          →  openMark
// RESOLVE_MARK       →  resolveMark(markId, actionId)
// SET_ERROR          →  (none; surfaces a failed server action)

export type WriteAction =
  | { type: "EDIT_BODY"; body: unknown }
  | { type: "SET_MARKS"; marks: Mark[] }
  | { type: "SAVE_MANUSCRIPT" }
  | { type: "SAVE_SUCCEEDED" }
  | { type: "OPEN_MARK"; markKey: string | null }
  | { type: "RESOLVE_MARK"; markKey: string; actionId: "wiki" | "text" | "leave" }
  | { type: "SET_ERROR"; error: string | null };

// ---- Init -----------------------------------------------------------------

export function initWriteState(input: {
  chapterNumber: number;
  body: unknown;
  marks?: Mark[];
  resolvedMarkKeys?: string[];
}): WriteState {
  return {
    chapterNumber: input.chapterNumber,
    body: input.body,
    marks: input.marks ?? [],
    openMarkKey: null,
    resolvedMarkKeys: input.resolvedMarkKeys ?? [],
    dirty: false,
    error: null,
  };
}

// ---- Reducer (pure) -------------------------------------------------------

export function writeReducer(state: WriteState, action: WriteAction): WriteState {
  switch (action.type) {
    case "EDIT_BODY":
      return { ...state, body: action.body, dirty: true };

    case "SET_MARKS":
      // Defense in depth: never surface a locally-resolved ('leave'/'not now')
      // mark, even if a check pass re-emits it before the server round-trips.
      return {
        ...state,
        marks: action.marks.filter(
          (m) => !state.resolvedMarkKeys.includes(m.markKey),
        ),
      };

    case "SAVE_MANUSCRIPT":
      // Optimistic no-op; SAVE_SUCCEEDED / SET_ERROR follow the server action.
      return state;

    case "SAVE_SUCCEEDED":
      return { ...state, dirty: false, error: null };

    case "OPEN_MARK":
      // One open at a time; clicking the open one again closes it.
      return {
        ...state,
        openMarkKey: state.openMarkKey === action.markKey ? null : action.markKey,
      };

    case "RESOLVE_MARK":
      // Only 'leave' changes local suppression state. 'text'/'wiki' are handled
      // by the editor / confirmed wiki path respectively.
      if (action.actionId === "leave") {
        return {
          ...state,
          resolvedMarkKeys: [...new Set([...state.resolvedMarkKeys, action.markKey])],
          // Remove the mark now so its underline clears immediately, rather than
          // lingering until the next check pass (which felt like a no-op).
          marks: state.marks.filter((m) => m.markKey !== action.markKey),
          openMarkKey: state.openMarkKey === action.markKey ? null : state.openMarkKey,
        };
      }
      return state;

    case "SET_ERROR":
      return { ...state, error: action.error };

    default:
      return assertNever(action);
  }
}

function assertNever(x: never): never {
  throw new Error(`writeReducer: unhandled action ${JSON.stringify(x)}`);
}
