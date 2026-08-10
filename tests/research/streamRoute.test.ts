import { describe, it, expect, vi, beforeEach } from "vitest";

// -----------------------------------------------------------------------------
// F2b HARD GATE — THE ROUTE SEAM. finalizeStream.test.ts proves the pure
// finalizer, but nothing there drives an aborted req.signal THROUGH the route.
// This test does: it calls the real POST handler with a mocked streamComplete
// (yields clean prose, returns => the stream "completed"), a fake persist spy,
// and a request whose AbortSignal is aborted. The line under proof is
// route.ts:  `completed: completed && !req.signal.aborted`
// which converts an abort into completed:false so finalize persists NOTHING —
// no half-pair — even though the upstream stream itself finished cleanly.
//
// Mutation proof (owned by this file): delete `&& !req.signal.aborted` at the
// route seam and the abort test flips to persist CALLED = RED; the clean
// baseline stays GREEN either way (it never aborts), so it cannot mask the
// regression.
// -----------------------------------------------------------------------------

const insertSpy = vi.fn(async () => ({
  you: { ordinal: 4 },
  them: { ordinal: 5 },
}));

// streamComplete is an async generator; the mock yields prose then returns
// (a clean message_stop => the route sets completed=true). The route passes
// req.signal in, but the mock ignores it: we want completed to be TRUE so the
// ONLY thing that can still block persist is the `!req.signal.aborted` seam.
async function* fakeStream() {
  yield "The sky is blue and clear today.";
}

vi.mock("@/lib/ai/saarouters", () => ({
  aiEnabled: () => true,
  streamComplete: vi.fn(() => fakeStream()),
}));

vi.mock("@/lib/db/queries", () => ({
  loadWikiSnapshot: vi.fn(async () => ({ entries: [] })),
}));

vi.mock("@/lib/db/mutations", () => ({
  insertResearchTurnPair: (...args: unknown[]) => insertSpy(...(args as [])),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/research/stream/route";

/** Build a POST request to the stream route, wired to the given AbortSignal. */
function streamRequest(signal: AbortSignal): NextRequest {
  return new NextRequest("http://localhost/api/research/stream", {
    method: "POST",
    body: JSON.stringify({ question: "What color is the sky?", threadId: "th-1" }),
    signal,
  });
}

/** Drain the NDJSON response body into an array of parsed frames. */
async function readFrames(res: Response): Promise<Array<{ type: string; [k: string]: unknown }>> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { type: string });
}

describe("research stream route — abort seam (persist-or-nothing)", () => {
  beforeEach(() => {
    insertSpy.mockClear();
  });

  it("persists NOTHING and emits no 'done' when req.signal is aborted, even though the stream completed", async () => {
    const ac = new AbortController();
    ac.abort(); // client already gone before we finalize
    const res = await POST(streamRequest(ac.signal));
    const frames = await readFrames(res);

    // THE seam: abort => completed:false => finalize persists nothing.
    expect(insertSpy).not.toHaveBeenCalled();
    // No half-pair signalled to the client either.
    expect(frames.some((f) => f.type === "done")).toBe(false);
    // And we do NOT push an error frame to an already-departed client.
    expect(frames.some((f) => f.type === "error")).toBe(false);
  });

  it("persists the pair ONCE and emits 'done' on a clean, non-aborted stream (baseline)", async () => {
    const ac = new AbortController(); // never aborted
    const res = await POST(streamRequest(ac.signal));
    const frames = await readFrames(res);

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const done = frames.find((f) => f.type === "done");
    expect(done).toBeDefined();
    expect((done?.turns as unknown[]).length).toBe(2);
  });
});
