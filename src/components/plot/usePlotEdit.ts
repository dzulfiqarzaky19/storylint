"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useServerAction } from "@/components/hooks/useServerAction";
import {
  renamePlotlineAction,
  setPlotlineStateAction,
  upsertBeatAction,
  deleteBeatAction,
  moveBeatAction,
  createPlotlineAction,
  deletePlotlineAction,
} from "@/lib/actions/plot";
import { type ActionResult } from "@/lib/actions/confirmation";

/** The edit surface handed down to the grid + drawer. Each method fires a /plot
 *  server action inside a transition, then refreshes the route so the server-
 *  rendered grid reflects the write; `pending` disables controls mid-flight and
 *  `error` surfaces a failed write (the store never swallows it). Scope
 *  (worldId/bookId) is captured here so callers pass only the row-level ids. */
export interface PlotEdit {
  pending: boolean;
  error: string | null;
  clearError: () => void;
  rename: (plotlineId: string, name: string) => void;
  setState: (plotlineId: string, state: "open" | "resolved" | "abandoned", resolvedAt: number | null) => void;
  saveBeat: (plotlineId: string, chapterNumber: number, summary: string) => void;
  removeBeat: (plotlineId: string, chapterNumber: number) => void;
  moveBeat: (plotlineId: string, fromChapterNumber: number, toChapterNumber: number) => void;
  createLane: (name: string) => void;
  deleteLane: (plotlineId: string) => void;
}

export function usePlotEdit(worldId: string, bookId: string): PlotEdit {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { pending, run: runOne } = useServerAction(setError);

  // Run one action, surface its error, and refresh on success so the server
  // re-reads the grid. Kept generic so every method below is a one-liner.
  const run = (fn: () => Promise<ActionResult<unknown>>) => {
    setError(null);
    runOne(fn(), { onSuccess: () => router.refresh() });
  };

  return {
    pending,
    error,
    clearError: () => setError(null),
    rename: (plotlineId, name) => run(() => renamePlotlineAction({ plotlineId, name })),
    setState: (plotlineId, state, resolvedAt) =>
      run(() => setPlotlineStateAction({ plotlineId, state, resolvedAt })),
    saveBeat: (plotlineId, chapterNumber, summary) =>
      run(() => upsertBeatAction({ bookId, plotlineId, chapterNumber, summary })),
    removeBeat: (plotlineId, chapterNumber) =>
      run(() => deleteBeatAction({ bookId, plotlineId, chapterNumber })),
    moveBeat: (plotlineId, fromChapterNumber, toChapterNumber) =>
      run(() => moveBeatAction({ bookId, plotlineId, fromChapterNumber, toChapterNumber })),
    createLane: (name) => run(() => createPlotlineAction({ worldId, name })),
    deleteLane: (plotlineId) => run(() => deletePlotlineAction({ plotlineId })),
  };
}
