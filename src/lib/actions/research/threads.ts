"use server";

// ============================================================================
// Research thread server actions (create / delete / rename)
// Split out of the former monolithic research.ts (T-ARCH-9). runAction/runActionBare
// envelopes are unchanged; only file boundaries moved.
// ============================================================================

import { type ActionResult, requireWorldId, runActionBare } from "../confirmation";
import {
  deleteLastThreadGuarded,
  getNextResearchThreadSortOrder,
  insertResearchThread,
  updateThreadTitle,
} from "../../db/research-mutations";
import { randomUUID } from "node:crypto";
import { type ResearchScope } from "../../domain/types";

export async function createThread(input?: {
  title?: string;
  subtitle?: string;
  scope?: ResearchScope;
  worldId?: string;
}): Promise<ActionResult<{ threadId: string }>> {
  return runActionBare(async () => {
    // T-ARCH-4 FAIL CLOSED: a thread belongs to ONE world. A blank/missing
    // worldId used to fall through to insertResearchThread's DEFAULT_WORLD_ID,
    // minting a thread invisible on the writer's actual rail. Refuse rather
    // than stamp the default (mirrors confirmCard). Input stays optional so a
    // raw createThread() / createThread({}) still type-checks — the watch test
    // locks that hole at runtime.
    const worldGuard = requireWorldId(input?.worldId, "createThread", " - refusing to create a world-orphan thread");
    if (!worldGuard.ok) return worldGuard;
    const worldId = worldGuard.worldId;
    const id = randomUUID();
    // T-RESEARCH-2: order it within that world's rail and stamp its world_id
    // so it appears under the world the writer is in.
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

// Hard-delete a whole thread. `research_turns.thread_id` is bare text with no FK
// (schema.sql:93), so deleting the thread row does NOT cascade to its turns —
// the mutation removes turns FIRST, then the thread row, in one txn (props and
// kept_cards cascade from turns). Not a wiki write; needs no confirmation token.
// R3 floor: refuses a world's LAST thread (deleteLastThreadGuarded) so a raw call
// can't empty a live world's rail — the UI hides the trash at one thread (E13), but
// a direct action call had no such guard.
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

// Rename a thread from the rail (user step 1a: a thread's name is editable for
// cataloguing). A blank title is rejected: an empty title would re-arm the
// auto-title UPDATE (guarded WHERE title='' OR title='New thread'), silently
// clobbering the writer's rename on the next AI answer — the opposite of the
// manual-wins rule. Not a wiki write; needs no confirmation token.
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
