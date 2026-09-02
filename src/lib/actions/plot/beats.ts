"use server";

// ============================================================================
// Beat server actions (upsert / delete / move)
// Split out of the former monolithic plot.ts (T-ARCH-9). runAction/runActionBare
// envelopes are unchanged; only file boundaries moved.
// ============================================================================

import { revalidatePath } from "next/cache";
import { type ActionResult, runAction } from "../confirmation";
import { deleteBeat, moveBeat, upsertBeat } from "../../db/plot-mutations";

/** Feature 2 — create or edit the beat in a (chapter, plotline) cell. */
export async function upsertBeatAction(input: {
  bookId: string;
  plotlineId: string;
  chapterNumber: number;
  summary: string;
}): Promise<ActionResult> {
  return runAction("plot.upsertBeat", async () => {
    if (!input.summary.trim()) {
      return { ok: false, error: "plot.upsertBeat: beat text cannot be blank" };
    }
    await upsertBeat(input);
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  });
}

/** Feature 2 — delete the beat in a cell. */
export async function deleteBeatAction(input: {
  bookId: string;
  plotlineId: string;
  chapterNumber: number;
}): Promise<ActionResult> {
  return runAction("plot.deleteBeat", async () => {
    await deleteBeat(input);
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  });
}

/** Feature 1 — move a beat horizontally to another chapter in the same lane. */
export async function moveBeatAction(input: {
  bookId: string;
  plotlineId: string;
  fromChapterNumber: number;
  toChapterNumber: number;
}): Promise<ActionResult> {
  return runAction("plot.moveBeat", async () => {
    await moveBeat(input);
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  });
}
