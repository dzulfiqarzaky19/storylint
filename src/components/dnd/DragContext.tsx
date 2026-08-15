"use client";

// =============================================================================
// Drag context — shared DnD session state for the Wiki and
// Research screens (drag tiles between shelves, facts between tiles, cards onto
// the Kept board). Contract scaffold: provider + typed context + hook. No
// pointer wiring or rendering here; Phase 4/5 build against this shape.
//
// Invariant: ALL hover/zone feedback clears when a drag ends (endDrag), so no
// stale highlight can survive a drop or cancel.
// =============================================================================

import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { ReactNode } from "react";

// ---- Types ----------------------------------------------------------------

/** What is being dragged. `from` is the origin container (shelf id, entry id, board). */
export interface DragItem {
  type: "entry" | "fact" | "card";
  id: string;
  from: string;
}

/** The element currently hovered (for highlight), or null. */
export interface HoverTarget {
  type: "entry" | "fact" | "card" | "shelf" | "ties" | "board";
  id: string;
}

/** An active drop zone (a valid target region), or null. */
export interface DropZone {
  type: "shelf" | "entry" | "ties" | "board";
  id: string;
}

export interface DragState {
  dragging: DragItem | null;
  hoverTarget: HoverTarget | null;
  dropZone: DropZone | null;
}

export interface DragContextValue extends DragState {
  /** True while a drag is in progress. */
  readonly isDragging: boolean;
  startDrag: (item: DragItem) => void;
  setHover: (target: HoverTarget | null) => void;
  setZone: (zone: DropZone | null) => void;
  /** End the drag; clears dragging AND all hover/zone feedback. */
  endDrag: () => void;
}

// ---- Reducer --------------------------------------------------------------

type DragAction =
  | { type: "START"; item: DragItem }
  | { type: "SET_HOVER"; target: HoverTarget | null }
  | { type: "SET_ZONE"; zone: DropZone | null }
  | { type: "END" };

const INITIAL: DragState = { dragging: null, hoverTarget: null, dropZone: null };

function dragReducer(state: DragState, action: DragAction): DragState {
  switch (action.type) {
    case "START":
      return { dragging: action.item, hoverTarget: null, dropZone: null };
    case "SET_HOVER":
      return { ...state, hoverTarget: action.target };
    case "SET_ZONE":
      return { ...state, dropZone: action.zone };
    case "END":
      // Invariant: clear feedback along with the drag.
      return INITIAL;
    default:
      return state;
  }
}

// ---- Context --------------------------------------------------------------

const DragContext = createContext<DragContextValue | null>(null);

export function DragProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dragReducer, INITIAL);

  const startDrag = useCallback((item: DragItem) => dispatch({ type: "START", item }), []);
  const setHover = useCallback(
    (target: HoverTarget | null) => dispatch({ type: "SET_HOVER", target }),
    [],
  );
  const setZone = useCallback((zone: DropZone | null) => dispatch({ type: "SET_ZONE", zone }), []);
  const endDrag = useCallback(() => dispatch({ type: "END" }), []);

  const value = useMemo<DragContextValue>(
    () => ({
      ...state,
      isDragging: state.dragging !== null,
      startDrag,
      setHover,
      setZone,
      endDrag,
    }),
    [state, startDrag, setHover, setZone, endDrag],
  );

  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}

/** Access the drag context. Throws if used outside a DragProvider. */
export function useDrag(): DragContextValue {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error("useDrag must be used within a DragProvider");
  return ctx;
}
