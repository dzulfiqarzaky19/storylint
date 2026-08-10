import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, rows, closePool } from "@/lib/db/pool";
import {
  insertResearchThread,
  insertResearchTurnPair,
  deleteThread,
  updateThreadTitle,
} from "@/lib/db/mutations";
import { getResearchThread } from "@/lib/db/queries";

// -----------------------------------------------------------------------------
// F2a — research persistence (INTEGRATION, real Postgres). Proves the binding
// contracts on the mutation layer: atomic you+them(+cards) write, ordinal =
// MAX+1 computed INSIDE the txn, delete-thread cascade order, and the
// title UPDATE the auto-title rule relies on.
//
// SHARED-DB HYGIENE: every test operates on its OWN throwaway thread id
// (`test-f2a-<uuid>`) and hard-deletes it in afterEach, so this spec never
// touches the seeded threads other specs/e2e rely on. closePool() in afterAll
// releases the connection so vitest exits cleanly.
// -----------------------------------------------------------------------------

loadEnv();

const created: string[] = [];

async function freshThread(title = "New thread"): Promise<string> {
  const id = `test-f2a-${randomUUID()}`;
  await insertResearchThread({ id, title, subtitle: "", sortOrder: 999, scope: "chat" });
  created.push(id);
  return id;
}

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterEach(async () => {
  // Hard-clean every thread this run created, whatever the test did.
  while (created.length > 0) {
    const id = created.pop()!;
    await deleteThread(id);
  }
});

afterAll(async () => {
  await closePool();
});

describe("insertResearchTurnPair (atomic persist + ordinal-in-txn)", () => {
  it("persists [you, them] with the REAL threadId, ordered by ordinal ASC, gap-free", async () => {
    const threadId = await freshThread();

    const ref = await insertResearchTurnPair({
      threadId,
      youId: `you-${randomUUID()}`,
      themId: `them-${randomUUID()}`,
      who: { you: "You", them: "Collaborator" },
      question: "who collects the salt debt?",
      reply: "The house that named you does.",
      cards: [],
    });

    const back = await getResearchThread(threadId);
    expect(back).toHaveLength(2);
    // Real threadId, not "".
    expect(back.every((t) => t.threadId === threadId)).toBe(true);
    // Ordered you then them.
    expect(back.map((t) => t.side)).toEqual(["you", "them"]);
    expect(back.map((t) => t.text)).toEqual([
      "who collects the salt debt?",
      "The house that named you does.",
    ]);
    // Contiguous, gap-free ordinals starting at 0 for a fresh thread.
    expect(back.map((t) => t.ordinal)).toEqual([0, 1]);
    expect(ref.you.ordinal).toBe(0);
    expect(ref.them.ordinal).toBe(1);
  });

  it("computes MAX(ordinal)+1 in-txn so a SECOND pair appends contiguously (no collision)", async () => {
    const threadId = await freshThread();

    await insertResearchTurnPair({
      threadId,
      youId: `you-${randomUUID()}`,
      themId: `them-${randomUUID()}`,
      who: { you: "You", them: "Collaborator" },
      question: "first question",
      reply: "first reply",
      cards: [],
    });
    const second = await insertResearchTurnPair({
      threadId,
      youId: `you-${randomUUID()}`,
      themId: `them-${randomUUID()}`,
      who: { you: "You", them: "Collaborator" },
      question: "second question",
      reply: "second reply",
      cards: [],
    });

    const back = await getResearchThread(threadId);
    // Four contiguous ordinals 0..3 — the second pair read MAX+1 (=2), not 0.
    expect(back.map((t) => t.ordinal)).toEqual([0, 1, 2, 3]);
    expect(second.you.ordinal).toBe(2);
    expect(second.them.ordinal).toBe(3);
    // Deterministic order under ordinal ASC.
    expect(back.map((t) => t.text)).toEqual([
      "first question",
      "first reply",
      "second question",
      "second reply",
    ]);
  });

  it("persists the them-turn's cards under the them-turn only", async () => {
    const threadId = await freshThread();
    await insertResearchTurnPair({
      threadId,
      youId: `you-${randomUUID()}`,
      themId: `them-${randomUUID()}`,
      who: { you: "You", them: "Collaborator" },
      question: "q",
      reply: "r",
      cards: [
        { id: `card-${randomUUID()}`, kind: "lore", title: "Salt debt", body: "A naming price.", asKind: "lore" },
        { id: `card-${randomUUID()}`, kind: "character", title: "The Collector", body: "Comes at low water.", asKind: "character" },
      ],
    });

    const back = await getResearchThread(threadId);
    const you = back.find((t) => t.side === "you")!;
    const them = back.find((t) => t.side === "them")!;
    expect(you.cards).toHaveLength(0);
    expect(them.cards).toHaveLength(2);
    expect(them.cards.map((c) => c.title)).toEqual(["Salt debt", "The Collector"]);
    // sort_order follows input order.
    expect(them.cards.map((c) => c.sortOrder)).toEqual([0, 1]);
  });

  it("rejects an empty threadId (never writes an orphan turn)", async () => {
    await expect(
      insertResearchTurnPair({
        threadId: "",
        youId: `you-${randomUUID()}`,
        themId: `them-${randomUUID()}`,
        who: { you: "You", them: "Collaborator" },
        question: "q",
        reply: "r",
        cards: [],
      }),
    ).rejects.toThrow(/threadId is required/);
  });

  it("is ATOMIC: a duplicate them-id (2nd insert) rolls back the whole pair", async () => {
    const threadId = await freshThread();
    const dupThemId = `them-${randomUUID()}`;
    // Pre-seed a turn that will collide with the them-turn's primary key.
    await query(
      `INSERT INTO research_turns (id, thread_id, ordinal, side, who, text)
       VALUES ($1, $2, 5, 'them', 'Collaborator', 'pre-existing')`,
      [dupThemId, threadId],
    );

    await expect(
      insertResearchTurnPair({
        threadId,
        youId: `you-${randomUUID()}`,
        themId: dupThemId, // duplicate PK -> them insert fails mid-txn
        who: { you: "You", them: "Collaborator" },
        question: "q",
        reply: "r",
        cards: [],
      }),
    ).rejects.toThrow();

    // The you-turn must NOT have persisted (whole pair rolled back). Only the
    // pre-seeded them-turn remains.
    const back = await getResearchThread(threadId);
    expect(back).toHaveLength(1);
    expect(back[0]!.text).toBe("pre-existing");
  });
});

describe("deleteThread (cascade order)", () => {
  it("hard-deletes the thread AND its turns/props (no orphan turns)", async () => {
    const threadId = await freshThread();
    await insertResearchTurnPair({
      threadId,
      youId: `you-${randomUUID()}`,
      themId: `them-${randomUUID()}`,
      who: { you: "You", them: "Collaborator" },
      question: "q",
      reply: "r",
      cards: [{ id: `card-${randomUUID()}`, kind: "lore", title: "t", body: "b", asKind: "lore" }],
    });

    await deleteThread(threadId);

    const threadRows = await rows(`SELECT id FROM research_threads WHERE id = $1`, [threadId]);
    const turnRows = await rows(`SELECT id FROM research_turns WHERE thread_id = $1`, [threadId]);
    const propRows = await rows(
      `SELECT p.id FROM propositions p
       JOIN research_turns t ON t.id = p.turn_id WHERE t.thread_id = $1`,
      [threadId],
    );
    expect(threadRows).toHaveLength(0);
    expect(turnRows).toHaveLength(0); // the crux: bare-text FK does NOT cascade, so we delete turns explicitly
    expect(propRows).toHaveLength(0);

    // Nothing left to clean (deleteThread already removed it); drop from tracker.
    const idx = created.indexOf(threadId);
    if (idx >= 0) created.splice(idx, 1);
  });
});

describe("updateThreadTitle", () => {
  it("writes the new title for the thread", async () => {
    const threadId = await freshThread("New thread");
    await updateThreadTitle({ threadId, title: "who collects the salt debt" });
    const back = await rows<{ title: string }>(
      `SELECT title FROM research_threads WHERE id = $1`,
      [threadId],
    );
    expect(back[0]!.title).toBe("who collects the salt debt");
  });
});

describe("insertResearchTurnPair auto-title (same-txn)", () => {
  async function titleOf(threadId: string): Promise<string> {
    const back = await rows<{ title: string }>(
      `SELECT title FROM research_threads WHERE id = $1`,
      [threadId],
    );
    return back[0]!.title;
  }

  it("names a 'New thread' placeholder from the first question", async () => {
    const threadId = await freshThread("New thread");
    await insertResearchTurnPair({
      threadId,
      youId: `you-${randomUUID()}`,
      themId: `them-${randomUUID()}`,
      who: { you: "You", them: "Collaborator" },
      question: "who collects the salt debt?",
      reply: "The house does.",
      cards: [],
      autoTitle: "who collects the salt debt",
    });
    expect(await titleOf(threadId)).toBe("who collects the salt debt");
  });

  it("names an EMPTY title from the first question", async () => {
    const threadId = await freshThread("");
    await insertResearchTurnPair({
      threadId,
      youId: `you-${randomUUID()}`,
      themId: `them-${randomUUID()}`,
      who: { you: "You", them: "Collaborator" },
      question: "q",
      reply: "r",
      cards: [],
      autoTitle: "derived title",
    });
    expect(await titleOf(threadId)).toBe("derived title");
  });

  it("does NOT overwrite an already-named thread", async () => {
    const threadId = await freshThread("A named thread");
    await insertResearchTurnPair({
      threadId,
      youId: `you-${randomUUID()}`,
      themId: `them-${randomUUID()}`,
      who: { you: "You", them: "Collaborator" },
      question: "q",
      reply: "r",
      cards: [],
      autoTitle: "should be ignored",
    });
    expect(await titleOf(threadId)).toBe("A named thread");
  });

  it("leaves the title untouched when autoTitle is omitted", async () => {
    const threadId = await freshThread("New thread");
    await insertResearchTurnPair({
      threadId,
      youId: `you-${randomUUID()}`,
      themId: `them-${randomUUID()}`,
      who: { you: "You", them: "Collaborator" },
      question: "q",
      reply: "r",
      cards: [],
    });
    expect(await titleOf(threadId)).toBe("New thread");
  });
});
