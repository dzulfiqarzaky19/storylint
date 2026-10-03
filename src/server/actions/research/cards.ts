"use server";

import { type ActionResult, runActionBare } from "@/domain/result";
import { deleteKeptCard, upsertKeptCard } from "@/server/db/research/mutations";

export async function keepCard(
  propositionId: string,
  kept: boolean,
): Promise<ActionResult> {
  return runActionBare(async () => {
    if (kept) {
      await upsertKeptCard({ propositionId, keptAt: Date.now() });
    } else {
      await deleteKeptCard(propositionId);
    }
    return { ok: true, data: undefined };
  });
}

export async function proposeCard(propositionId: string): Promise<ActionResult> {
  void propositionId;
  return { ok: true, data: undefined };
}

export async function cancelPending(): Promise<ActionResult> {
  return { ok: true, data: undefined };
}
