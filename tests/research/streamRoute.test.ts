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

// Capture the prompt the route actually assembles, so the F5 locked-line
// assertions below check REAL route+prompt output (not the pure unit in
// isolation). streamComplete still yields the fake prose so the stream path runs.
// vi.hoisted: these are referenced inside the hoisted vi.mock factories below.
const { streamArgs, WIKI_ENTRIES } = vi.hoisted(() => {
  function entryFixture(id: string, kind: string, name: string) {
    return {
      id,
      kind,
      name,
      catalogueNo: "",
      note: "",
      summary: "",
      shelf: "people",
      sortOrder: 0,
      facts: [],
      ties: [],
      appearances: [],
      openQuestions: [],
    };
  }
  return {
    streamArgs: [] as Array<{
      system: string;
      messages: Array<{ content: string }>;
      temperature?: number;
    }>,
    // One entry of every kind so the "all entries" locked line is observable at
    // the route boundary.
    WIKI_ENTRIES: [
      entryFixture("c1", "character", "Alice"),
      entryFixture("w1", "world", "Rivertown"),
      entryFixture("o1", "organization", "The Guild"),
      entryFixture("l1", "lore", "The Old War"),
    ],
  };
});

vi.mock("@/lib/ai/saarouters", () => ({
  aiEnabled: () => true,
  streamComplete: vi.fn(
    (args: {
      system: string;
      messages: Array<{ content: string }>;
      temperature?: number;
    }) => {
      streamArgs.push(args);
      return fakeStream();
    },
  ),
}));

// F5: the route no longer reads a per-thread scope (getResearchThreadScope was
// deleted). Only loadWikiSnapshot is consumed; the gazetteer is built from the
// FULL entry list via buildGazetteer.
vi.mock("@/lib/db/queries", () => ({
  loadWikiSnapshot: vi.fn(async () => ({ entries: WIKI_ENTRIES })),
  // The route reads prior thread turns via getResearchThread(threadId) and maps
  // them to { side, text }. These tests exercise the stream/abort/prompt seams,
  // not history replay, so an empty prior-turn list is the faithful mock surface.
  getResearchThread: vi.fn(async () => []),
}));

vi.mock("@/lib/db/mutations", () => ({
  insertResearchTurnPair: (...args: unknown[]) => insertSpy(...(args as [])),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/research/stream/route";
import { CARDS_SENTINEL } from "@/lib/research/streamParse";

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

// F5 (fully-free research chat): the 3 locked behavior-bearing lines, asserted
// against the REAL route+prompt output (the route composes buildGazetteer +
// buildResearchPrompt). streamArgs captures exactly what the route hands to the
// gateway.
describe("research stream route — F5 free-context prompt (3 locked lines)", () => {
  beforeEach(() => {
    insertSpy.mockClear();
    streamArgs.length = 0;
  });

  async function runAndCapture(): Promise<{ system: string; user: string }> {
    const ac = new AbortController();
    const res = await POST(streamRequest(ac.signal));
    await readFrames(res); // drain so the stream (and its streamComplete call) runs
    const call = streamArgs[0];
    expect(call).toBeDefined();
    return { system: call!.system, user: call!.messages[0]!.content };
  }

  // LOCKED LINE 1: gazetteer built from FULL entries (no scope narrowing) — every
  // kind's entry name reaches the prompt.
  it("puts EVERY wiki entry (all kinds) into the gazetteer the model sees", async () => {
    const { user } = await runAndCapture();
    expect(user).toContain("Alice"); // character
    expect(user).toContain("Rivertown"); // world
    expect(user).toContain("The Guild"); // organization
    expect(user).toContain("The Old War"); // lore
  });

  // LOCKED LINE 2: NO scope-narrowing directive (POSITIVE + NEGATIVE).
  it("frames the answer as free across the ENTIRE wiki with no scope restriction", async () => {
    const { system } = await runAndCapture();
    expect(system).not.toMatch(/Only answer within/i);
    expect(system).not.toMatch(/scoped to/i);
    expect(system).toMatch(/ENTIRE wiki/);
    expect(system).toMatch(/answer freely/i);
  });

  // LOCKED LINE 3: the CARDS_SENTINEL delimiter still ships (card capture intact).
  it("still instructs the model to emit the CARDS_SENTINEL delimiter", async () => {
    const { system } = await runAndCapture();
    expect(system).toContain(CARDS_SENTINEL);
  });
});

// F5-S4 (runtime regression fix): the streaming research route must NOT pass a
// `temperature` to streamComplete. The SaaRouters gateway returns an empty 200
// then ECONNRESET when temperature is sent alongside a large prompt, and F5
// enlarged this prompt (full wiki), so passing temperature hangs the Ask/chip
// path forever ("Thinking..." with zero bytes). The blocking path omits it for
// the same reason. Mutation-provable lock: re-add `temperature: 0.7` at the
// route call and this assertion goes RED.
describe("research stream route — F5-S4 no temperature (gateway hang guard)", () => {
  beforeEach(() => {
    insertSpy.mockClear();
    streamArgs.length = 0;
  });

  it("does NOT pass a temperature to streamComplete (gateway-default sampling)", async () => {
    const ac = new AbortController();
    const res = await POST(streamRequest(ac.signal));
    await readFrames(res); // drain so streamComplete is actually invoked
    const call = streamArgs[0];
    expect(call).toBeDefined();
    expect(call!.temperature).toBeUndefined();
    expect("temperature" in call!).toBe(false);
  });
});
