"use server";

// ============================================================================
// Plotline server actions (rename / state / create / delete)
// Split out of the former monolithic plot.ts (T-ARCH-9). runAction/runActionBare
// envelopes are unchanged; only file boundaries moved.
// ============================================================================

import { revalidatePath } from "next/cache";
import { type ActionResult, requireWorldId, runAction } from "../confirmation";
import {
  createPlotline,
  deletePlotline,
  renamePlotline,
  setPlotlineState,
  type SettablePlotState,
} from "../../db/plot-mutations";

/** Feature 3 — rename a plotline lane. */
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

/** Feature 5 — set a lane's arc state (open / resolved / abandoned). */
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

/** Feature 4 — create a new plotline lane in the active world. */
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

/** Feature 4 — delete (soft) a plotline lane. */
export async function deletePlotlineAction(input: {
  plotlineId: string;
}): Promise<ActionResult> {
  return runAction("plot.deletePlotline", async () => {
    await deletePlotline({ plotlineId: input.plotlineId, deletedAt: Date.now() });
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  });
}
