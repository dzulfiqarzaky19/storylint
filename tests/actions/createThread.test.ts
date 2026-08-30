/**
 * createThread fail-closed (T-ARCH-4).
 *
 * A thread belongs to ONE world. createThread used to treat worldId as optional
 * and fall through to insertResearchThread's DEFAULT_WORLD_ID, so a raw
 * createThread() / createThread({}) minted a thread in the default world
 * (invisible on a non-default world's rail). Mirror confirmCard: refuse a
 * blank/missing worldId BEFORE any insert.
 *
 * MUTANT (must RED): drop the `if (!worldId)` refuse in createThread. Then
 * createThread() / createThread({}) return { ok: true } and the insert mock
 * fires. Inverse the drop; this file goes GREEN again.
 *
 * Unit: DB mocked. insertResearchThread must NOT be called on refuse.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const insertResearchThread = vi.fn(async (input: { id: string; worldId?: string }) => ({
  id: input.id,
  worldId: input.worldId,
}));
const getNextResearchThreadSortOrder = vi.fn(async () => 0);

vi.mock("@/lib/db/research-mutations", () => ({
  insertResearchThread: (input: { id: string; worldId?: string }) =>
    insertResearchThread(input),
  getNextResearchThreadSortOrder: () => getNextResearchThreadSortOrder(),
  markKeptInWiki: vi.fn(),
  upsertKeptCard: vi.fn(),
  deleteKeptCard: vi.fn(),
  getProposition: vi.fn(),
  insertResearchTurnPair: vi.fn(),
  deleteLastThreadGuarded: vi.fn(),
  updateThreadTitle: vi.fn(),
}));

vi.mock("@/lib/db/gazetteer-mutations", () => ({
  insertEntryLinkedToWorld: vi.fn(),
  insertFact: vi.fn(),
  getMaxSortOrderForShelf: vi.fn(),
  getMaxSortOrderForFacts: vi.fn(),
}));

vi.mock("@/lib/db/gazetteer", () => ({
  loadWikiSnapshot: vi.fn(),
  loadWorldSnapshot: vi.fn(),
  getEntry: vi.fn(),
}));

vi.mock("@/lib/db/research-queries", () => ({
  getResearchThreadWorldId: vi.fn(),
}));

vi.mock("@/lib/ai/saarouters", () => ({
  complete: vi.fn(),
  completeJson: vi.fn(),
  aiEnabled: vi.fn(() => false),
}));

import { createThread } from "@/lib/actions/research";

beforeEach(() => {
  insertResearchThread.mockClear();
  getNextResearchThreadSortOrder.mockClear();
});

describe("createThread fail-closed (T-ARCH-4)", () => {
  it("refuses createThread() with no args — no insert", async () => {
    const res = await createThread();
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected refuse");
    expect(res.error).toMatch(/missing worldId/i);
    expect(insertResearchThread).not.toHaveBeenCalled();
  });

  it("refuses createThread({}) — no insert", async () => {
    const res = await createThread({});
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected refuse");
    expect(res.error).toMatch(/missing worldId/i);
    expect(insertResearchThread).not.toHaveBeenCalled();
  });

  it("refuses a blank/whitespace worldId — no insert", async () => {
    const res = await createThread({ worldId: "   " });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected refuse");
    expect(res.error).toMatch(/missing worldId/i);
    expect(insertResearchThread).not.toHaveBeenCalled();
  });

  it("stamps a named worldId through to insertResearchThread", async () => {
    const res = await createThread({ worldId: "world-vosk" });
    expect(res.ok).toBe(true);
    expect(insertResearchThread).toHaveBeenCalledTimes(1);
    const forwarded = insertResearchThread.mock.calls[0]![0] as { worldId?: string };
    expect(forwarded.worldId).toBe("world-vosk");
  });
});
