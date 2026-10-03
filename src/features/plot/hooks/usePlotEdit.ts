"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useServerAction } from "@/hooks/useServerAction";
import { renamePlotlineAction, setPlotlineStateAction, createPlotlineAction, deletePlotlineAction } from "@/server/actions/plot/plotlines";
import { upsertBeatAction, deleteBeatAction, moveBeatAction } from "@/server/actions/plot/beats";
import { type ActionResult } from "@/domain/result";

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
