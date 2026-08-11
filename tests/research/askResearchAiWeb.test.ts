import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// -----------------------------------------------------------------------------
// F10 — askResearchAi (the BLOCKING action) web-search wiring gate.
//
// The stream route got the web path first; this test proves the OTHER answer
// path — the blocking `askResearchAi` server action — ALSO retrieves, injects
// full-body web context into the model prompt, and holds the reply's citations
// to exactly the URLs read. A live browser test caught that this path was
// unwired; these are the mutation-provable locks so it cannot silently regress.
//
// Boundaries mocked: the AI gateway (capture completeJson args + drive the
// reply), the DB (snapshot + persist), and the ENGINE ENTRYPOINT (retrieve /
// buildSearchImpl). The REAL adapter (renderWebContext/collectAllowedUrls) and
// the REAL enforceCitations run, so the test exercises the actual composition
// this action performs, not a restatement of it.
// -----------------------------------------------------------------------------

const { completeJsonArgs, retrieveCalls, RETRIEVAL, WIKI } = vi.hoisted(() => ({
  completeJsonArgs: [] as Array<{ system: string; messages: Array<{ content: string }> }>,
  retrieveCalls: [] as string[],
  // One read page with a real URL — renderWebContext turns this into the
  // [Source 1] block, collectAllowedUrls yields exactly this URL.
  RETRIEVAL: {
    query: "who is frodo",
    results: [{ url: "https://lotr.fandom.com/wiki/Frodo", title: "Frodo", snippet: "", source: "searxng" }],
    read: [
      {
        url: "https://lotr.fandom.com/wiki/Frodo",
        title: "Frodo Baggins",
        markdown: "Frodo Baggins is a hobbit of the Shire who carries the One Ring.",
      },
    ],
  },
  WIKI: { entries: [] as unknown[] },
}));

// AI gateway: completeJson captures what the action assembled and returns a
// reply containing (a) an ALLOWED citation and (b) a HALLUCINATED citation, so
// enforceCitations behaviour is observable in the returned turn text.
let jsonReply = "";
vi.mock("@/lib/ai/saarouters", () => ({
  aiEnabled: () => true,
  completeJson: vi.fn(async (args: { system: string; messages: Array<{ content: string }> }) => {
    completeJsonArgs.push(args);
    return { reply: jsonReply, cards: [] };
  }),
  complete: vi.fn(async () => jsonReply),
}));

vi.mock("@/lib/db/queries", () => ({
  loadWikiSnapshot: vi.fn(async () => WIKI),
  getEntry: vi.fn(async () => null),
}));

vi.mock("@/lib/db/mutations", () => ({
  insertResearchTurnPair: vi.fn(async () => ({ you: { ordinal: 0 }, them: { ordinal: 1 } })),
}));

// Engine entrypoint: mock retrieve to hand back the fixture; buildSearchImpl is
// a no-op the action passes to retrieve (mocked, so unused).
vi.mock("@/lib/websearch/retrieve", () => ({
  retrieve: vi.fn(async (query: string) => {
    retrieveCalls.push(query);
    return RETRIEVAL;
  }),
  buildSearchImpl: vi.fn(() => async () => []),
}));

import { askResearchAi } from "@/lib/actions/research";

const SEARX = "http://localhost:8888";

describe("askResearchAi — F10 web-search wiring (blocking action)", () => {
  beforeEach(() => {
    completeJsonArgs.length = 0;
    retrieveCalls.length = 0;
    jsonReply =
      "Per [Frodo](https://lotr.fandom.com/wiki/Frodo) he bears the Ring; " +
      "also see [fake](https://evil.example.com/made-up).";
  });
  afterEach(() => {
    delete process.env.WEBSEARCH_SEARXNG_URL;
  });

  it("retrieves and injects full-body web context into the model prompt when web search is CONFIGURED", async () => {
    process.env.WEBSEARCH_SEARXNG_URL = SEARX;
    const res = await askResearchAi({ question: "who is frodo", threadId: "th-1" });
    expect(res.ok).toBe(true);

    // Retrieval actually ran for this question.
    expect(retrieveCalls).toEqual(["who is frodo"]);

    const call = completeJsonArgs[0];
    expect(call).toBeDefined();
    // FULL-body page text reached the user message (verbatim, no truncation).
    expect(call!.messages[0]!.content).toContain("Frodo Baggins is a hobbit of the Shire");
    expect(call!.messages[0]!.content).toContain("https://lotr.fandom.com/wiki/Frodo");
    // System prompt was re-framed to PERMIT citing web sources (without this the
    // gazetteer-only line makes the model refuse "I can't search the web").
    expect(call!.system).toMatch(/Web sources/i);
  });

  it("holds the reply's citations to exactly the URLs read (neutralizes hallucinated links)", async () => {
    process.env.WEBSEARCH_SEARXNG_URL = SEARX;
    const res = await askResearchAi({ question: "who is frodo", threadId: "th-1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const themText = res.data.turns[1]!.text;
    // Allowed citation survives as a link.
    expect(themText).toContain("[Frodo](https://lotr.fandom.com/wiki/Frodo)");
    // Hallucinated citation is neutralized to its visible text (link stripped).
    expect(themText).not.toContain("https://evil.example.com/made-up");
    expect(themText).toContain("fake");
  });

  it("does NOT retrieve or inject web context when web search is UNCONFIGURED (opt-in gate, wiki-only default)", async () => {
    // WEBSEARCH_SEARXNG_URL unset => cfg.enabled=false => no network, no context.
    const res = await askResearchAi({ question: "who is frodo", threadId: "th-1" });
    expect(res.ok).toBe(true);

    expect(retrieveCalls).toEqual([]);
    const call = completeJsonArgs[0];
    expect(call).toBeDefined();
    expect(call!.messages[0]!.content).not.toContain("Frodo Baggins is a hobbit");
    expect(call!.system).not.toMatch(/Web sources/i);
  });
});
