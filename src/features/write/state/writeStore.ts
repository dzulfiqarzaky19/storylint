import type { Mark } from "@/domain/check";

export interface WriteState {
  chapterNumber: number;
  body: unknown;
  marks: Mark[];
  openMarkKey: string | null;
  resolvedMarkKeys: string[];
  dirty: boolean;
  error: string | null;
}

export type WriteAction =
  | { type: "EDIT_BODY"; body: unknown }
  | { type: "SET_MARKS"; marks: Mark[] }
  | { type: "SAVE_MANUSCRIPT" }
  | { type: "SAVE_SUCCEEDED" }
  | { type: "OPEN_MARK"; markKey: string | null }
  | { type: "RESOLVE_MARK"; markKey: string; actionId: "wiki" | "text" | "leave" }
  | { type: "SET_ERROR"; error: string | null };

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

export function writeReducer(state: WriteState, action: WriteAction): WriteState {
  switch (action.type) {
    case "EDIT_BODY":
      return { ...state, body: action.body, dirty: true };

    case "SET_MARKS":
      return {
        ...state,
        marks: action.marks.filter(
          (m) => !state.resolvedMarkKeys.includes(m.markKey),
        ),
      };

    case "SAVE_MANUSCRIPT":
      return state;

    case "SAVE_SUCCEEDED":
      return { ...state, dirty: false, error: null };

    case "OPEN_MARK":
      return {
        ...state,
        openMarkKey: state.openMarkKey === action.markKey ? null : action.markKey,
      };

    case "RESOLVE_MARK":
      if (action.actionId === "leave") {
        return {
          ...state,
          resolvedMarkKeys: [...new Set([...state.resolvedMarkKeys, action.markKey])],
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
