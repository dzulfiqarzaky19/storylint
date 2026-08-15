import { describe, it, expect, vi, beforeEach } from "vitest";

// -----------------------------------------------------------------------------
// T-RESEARCH-2 (LOAD-BEARING) — the streamed research answer must be grounded on
// the THREAD's OWN world, not the whole universe. This is the live path the UI
// hits, so it is the one that makes a thread in world B stop seeing world A's
// canon. We drive the REAL POST handler and capture the prompt the route hands
// to the gateway; the gazetteer must contain ONLY the thread-world's entities.
//
// MUTATION PROOF (owned by this file): revert the route's grounding line back to
//   const wiki = await loadWikiSnapshot();
// (i.e. ignore threadWorldId) and the "world-scoped, not whole-wiki" assertion
// flips RED — the sibling-world entry "Ashkeld" leaks into the prompt. Restore
// the loadWorldSnapshot(threadWorldId) branch and it is GREEN again.
// -----------------------------------------------------------------------------

const insertSpy = vi.fn(async () => ({ you: { ordinal: 0 }, them: { ordinal: 1 } }));

async function* fakeStream() {
  yield "Grounded answer.";
}

const { streamArgs, WORLD_A_ENTRIES, WHOLE_WIKI_ENTRIES, worldCalls } = vi.hoisted(
  () => {
    function entry(id: string, name: string) {
      return {
        id,
        kind: "character",
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
      streamArgs: [] as Array<{ system: string; messages: Array<{ content: string }> }>,
      worldCalls: [] as string[],
      // The thread's world (world-B) holds ONLY "Blackspade".
      WORLD_A_ENTRIES: [entry("b1", "Blackspade")],
      // The whole wiki additionally holds a SIBLING-world entry "Ashkeld" that
      // must NEVER reach a world-B thread's prompt.
      WHOLE_WIKI_ENTRIES: [entry("b1", "Blackspade"), entry("a1", "Ashkeld")],
    };
  },
);

vi.mock("@/lib/ai/saarouters", () => ({
  aiEnabled: () => true,
  streamComplete: vi.fn((args: { system: string; messages: Array<{ content: string }> }) => {
    streamArgs.push(args);
    return fakeStream();
  }),
}));

// The route resolves the thread's world, then loads THAT world's snapshot. If it
// (wrongly) called loadWikiSnapshot it would pull the sibling-world entry too.
vi.mock("@/lib/db/queries", () => ({
  getResearchThreadWorldId: vi.fn(async () => "world-B"),
  loadWorldSnapshot: vi.fn(async (worldId: string) => {
    worldCalls.push(worldId);
    return { entries: WORLD_A_ENTRIES };
  }),
  loadWikiSnapshot: vi.fn(async () => ({ entries: WHOLE_WIKI_ENTRIES })),
  getResearchThread: vi.fn(async () => []),
}));

vi.mock("@/lib/db/mutations", () => ({
  insertResearchTurnPair: (...args: unknown[]) => insertSpy(...(args as [])),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/research/stream/route";

function req(): NextRequest {
  return new NextRequest("http://localhost/api/research/stream", {
    method: "POST",
    body: JSON.stringify({ question: "who lives here?", threadId: "th-world-b" }),
    signal: new AbortController().signal,
  });
}

async function capturePrompt(): Promise<{ system: string; user: string }> {
  const res = await POST(req());
  await res.text(); // drain so the stream (and streamComplete) actually runs
  const call = streamArgs[0];
  expect(call).toBeDefined();
  return { system: call!.system, user: call!.messages[0]!.content };
}

describe("research stream route — T-RESEARCH-2 world grounding (load-bearing)", () => {
  beforeEach(() => {
    insertSpy.mockClear();
    streamArgs.length = 0;
    worldCalls.length = 0;
  });

  it("grounds on the THREAD's world snapshot (loadWorldSnapshot with the thread's world id)", async () => {
    await capturePrompt();
    // The route resolved the thread's world and loaded THAT world, exactly once.
    expect(worldCalls).toEqual(["world-B"]);
  });

  it("puts ONLY the thread-world's entities in the gazetteer — never a sibling world's", async () => {
    const { user } = await capturePrompt();
    expect(user).toContain("Blackspade"); // the thread's own world
    // THE load-bearing assertion: reverting to loadWikiSnapshot leaks this in.
    expect(user).not.toContain("Ashkeld"); // a sibling world's entry
  });
});
