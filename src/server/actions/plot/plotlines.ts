"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, requireWorldId, runAction } from "@/domain/result";
import {
  createPlotline,
  deletePlotline,
  renamePlotline,
  setPlotlineState,
  type SettablePlotState,
} from "@/server/db/plot/mutations";

export async function renamePlotlineAction(input: {
  plotlineId: string;
  name: string;
}): Promise<ActionResult> {
  return runAction("plot.renamePlotline", async () => {
    await renamePlotline(input);
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  });
}

export async function setPlotlineStateAction(input: {
  plotlineId: string;
  state: SettablePlotState;
  resolvedAt: number | null;
}): Promise<ActionResult> {
  return runAction("plot.setPlotlineState", async () => {
    await setPlotlineState(input);
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  });
}

export async function createPlotlineAction(input: {
  worldId: string;
  name: string;
  label?: string;
}): Promise<ActionResult<{ plotlineId: string }>> {
  return runAction("plot.createPlotline", async () => {
    const world = requireWorldId(input.worldId, "plot.createPlotline", "");
    if (!world.ok) return world;
    if (!input.name.trim()) {
      return { ok: false, error: "plot.createPlotline: name cannot be blank" };
    }
    const { plotlineId } = await createPlotline({
      worldId: world.worldId,
      name: input.name,
      label: input.label,
    });
    revalidatePath("/plot");
    return { ok: true, data: { plotlineId } };
  });
}

export async function deletePlotlineAction(input: {
  plotlineId: string;
}): Promise<ActionResult> {
  return runAction("plot.deletePlotline", async () => {
    await deletePlotline({ plotlineId: input.plotlineId, deletedAt: Date.now() });
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  });
}
