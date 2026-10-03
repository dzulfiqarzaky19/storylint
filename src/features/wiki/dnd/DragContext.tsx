"use client";

import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { ReactNode } from "react";

export interface DragItem {
  type: "entry" | "fact" | "card";
  id: string;
  from: string;
}

export interface HoverTarget {
  type: "entry" | "fact" | "card" | "shelf" | "ties" | "board";
  id: string;
}

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
  readonly isDragging: boolean;
  startDrag: (item: DragItem) => void;
  setHover: (target: HoverTarget | null) => void;
  setZone: (zone: DropZone | null) => void;
  endDrag: () => void;
}

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
      return INITIAL;
    default:
      return state;
  }
}

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

export function useDrag(): DragContextValue {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error("useDrag must be used within a DragProvider");
  return ctx;
}
