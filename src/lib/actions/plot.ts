"use server";

// /plot server actions. The grid is now editable: rename a lane, set its arc
// state, create/edit/delete/move a beat, and create/delete a lane. Each action
// wraps a plot-mutations write in an ActionResult so the client can SURFACE a
// failed write instead of losing it, and revalidates /plot so the server-
// rendered grid reflects the change on the next read.
//
// A plot edit is an arrangement of the writer's own outline (not gated wiki
// knowledge), so no confirmation token is required — same posture as wiki
// moveEntry/reorderShelf.
import { revalidatePath } from "next/cache";
import {
  renamePlotline,
  setPlotlineState,
  upsertBeat,
  deleteBeat,
  moveBeat,
  createPlotline,
  deletePlotline,
  type SettablePlotState,
} from "../db/plot-mutations";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(err: unknown, where: string): { ok: false; error: string } {
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, error: `${where}: ${msg}` };
}

// A NEW lane is invisible on /plot until it has a world_entities link to the
// world being viewed (loadPlotProgression JOINs membership on the active world).
// If the caller cannot name that world, reject rather than mint an orphan.
function requireWorldId(
  worldId: string | undefined,
  where: string,
): { ok: true; worldId: string } | { ok: false; error: string } {
  const trimmed = worldId?.trim();
  if (!trimmed) return { ok: false, error: `${where}: missing worldId` };
  return { ok: true, worldId: trimmed };
}

/** Feature 3 — rename a plotline lane. */
export async function renamePlotlineAction(input: {
  plotlineId: string;
  name: string;
}): Promise<ActionResult> {
  try {
    await renamePlotline(input);
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "plot.renamePlotline");
  }
}

/** Feature 5 — set a lane's arc state (open / resolved / abandoned). */
export async function setPlotlineStateAction(input: {
  plotlineId: string;
  state: SettablePlotState;
  resolvedAt: number | null;
}): Promise<ActionResult> {
  try {
    await setPlotlineState(input);
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "plot.setPlotlineState");
  }
}

/** Feature 2 — create or edit the beat in a (chapter, plotline) cell. */
export async function upsertBeatAction(input: {
  bookId: string;
  plotlineId: string;
  chapterNumber: number;
  summary: string;
}): Promise<ActionResult> {
  try {
    if (!input.summary.trim()) {
      return { ok: false, error: "plot.upsertBeat: beat text cannot be blank" };
    }
    await upsertBeat(input);
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "plot.upsertBeat");
  }
}

/** Feature 2 — delete the beat in a cell. */
export async function deleteBeatAction(input: {
  bookId: string;
  plotlineId: string;
  chapterNumber: number;
}): Promise<ActionResult> {
  try {
    await deleteBeat(input);
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "plot.deleteBeat");
  }
}

/** Feature 1 — move a beat horizontally to another chapter in the same lane. */
export async function moveBeatAction(input: {
  bookId: string;
  plotlineId: string;
  fromChapterNumber: number;
  toChapterNumber: number;
}): Promise<ActionResult> {
  try {
    await moveBeat(input);
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "plot.moveBeat");
  }
}

/** Feature 4 — create a new plotline lane in the active world. */
export async function createPlotlineAction(input: {
  worldId: string;
  name: string;
  label?: string;
}): Promise<ActionResult<{ plotlineId: string }>> {
  try {
    const world = requireWorldId(input.worldId, "plot.createPlotline");
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
  } catch (err) {
    return fail(err, "plot.createPlotline");
  }
}

/** Feature 4 — delete (soft) a plotline lane. */
export async function deletePlotlineAction(input: {
  plotlineId: string;
}): Promise<ActionResult> {
  try {
    await deletePlotline({ plotlineId: input.plotlineId, deletedAt: Date.now() });
    revalidatePath("/plot");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "plot.deletePlotline");
  }
}
