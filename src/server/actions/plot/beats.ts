"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, runAction } from "@/domain/result";
import { deleteBeat, moveBeat, upsertBeat } from "@/server/db/plot/mutations";

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
