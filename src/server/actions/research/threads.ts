"use server";

import { type ActionResult, requireWorldId, runActionBare } from "@/domain/result";
import {
  deleteLastThreadGuarded,
  getNextResearchThreadSortOrder,
  insertResearchThread,
  updateThreadTitle,
} from "@/server/db/research/mutations";
import { randomUUID } from "node:crypto";
import { type ResearchScope } from "@/domain/types";

export async function createThread(input?: {
  title?: string;
  subtitle?: string;
  scope?: ResearchScope;
  worldId?: string;
}): Promise<ActionResult<{ threadId: string }>> {
  return runActionBare(async () => {
    const worldGuard = requireWorldId(input?.worldId, "createThread", " - refusing to create a world-orphan thread");
    if (!worldGuard.ok) return worldGuard;
    const worldId = worldGuard.worldId;
    const id = randomUUID();
    const sortOrder = await getNextResearchThreadSortOrder(worldId);
    const row = await insertResearchThread({
      id,
      title: input?.title?.trim() || "New thread",
      subtitle: input?.subtitle?.trim() ?? "",
      sortOrder,
      scope: input?.scope ?? "chat",
      worldId,
    });
    return { ok: true, data: { threadId: row.id } };
  });
}

export async function deleteThread(input: {
  threadId: string;
}): Promise<ActionResult<{ threadId: string }>> {
  const threadId = (input.threadId ?? "").trim();
  if (!threadId) return { ok: false, error: "No thread to delete." };
  return runActionBare(async () => {
    const deleted = await deleteLastThreadGuarded(threadId);
    if (!deleted) {
      return { ok: false, error: "Can't delete a world's last thread." };
    }
    return { ok: true, data: { threadId } };
  });
}

export async function renameThread(input: {
  threadId: string;
  title: string;
}): Promise<ActionResult<{ threadId: string; title: string }>> {
  const threadId = (input.threadId ?? "").trim();
  if (!threadId) return { ok: false, error: "No thread to rename." };
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "A thread name can't be empty." };
  return runActionBare(async () => {
    await updateThreadTitle({ threadId, title });
    return { ok: true, data: { threadId, title } };
  });
}
