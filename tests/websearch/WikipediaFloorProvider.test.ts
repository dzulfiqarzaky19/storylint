import { describe, it, expect } from "vitest";

import { WikipediaFloorProvider } from "@/lib/websearch/search/WikipediaFloorProvider";

// M5 — Wikipedia floor. A reliable, always-available provider so the engine
// still returns something when SearXNG is down/unconfigured. Same fail-soft
// contract: [] on any error, never throws.

const WIKI_JSON = {
  query: {
    search: [
      { title: "Dragon", snippet: "A dragon is a <span>large</span> creature" },
      { title: "Chinese dragon", snippet: "Legendary creature in Chinese mythology" },
    ],
  },
};

function fetchReturning(res: {
  status?: number;
  json?: unknown;
  text?: string;
  contentType?: string;
  throwErr?: Error;
}) {
  return async (): Promise<Response> => {
    if (res.throwErr) throw res.throwErr;
    const body = res.text ?? JSON.stringify(res.json ?? {});
    return new Response(body, {
      status: res.status ?? 200,
      headers: { "content-type": res.contentType ?? "application/json" },
    });
  };
}

describe("WikipediaFloorProvider", () => {
  it("is named wikipedia", () => {
    const p = new WikipediaFloorProvider({ fetchImpl: fetchReturning({ json: WIKI_JSON }) });
    expect(p.name).toBe("wikipedia");
  });

  it("maps search hits to http(s) wiki URLs and strips snippet HTML", async () => {
    const p = new WikipediaFloorProvider({ fetchImpl: fetchReturning({ json: WIKI_JSON }) });
    const out = await p.search("dragons");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      url: "https://en.wikipedia.org/wiki/Dragon",
      title: "Dragon",
      snippet: "A dragon is a large creature",
      source: "wikipedia",
    });
    // Title with a space becomes an underscored, URL-encoded path.
    expect(out[1]?.url).toBe("https://en.wikipedia.org/wiki/Chinese_dragon");
  });

  it("returns [] on a non-200 status", async () => {
    const p = new WikipediaFloorProvider({ fetchImpl: fetchReturning({ status: 500, json: WIKI_JSON }) });
    expect(await p.search("q")).toEqual([]);
  });

  it("returns [] on a thrown error (never propagates)", async () => {
    const p = new WikipediaFloorProvider({ fetchImpl: fetchReturning({ throwErr: new Error("network") }) });
    expect(await p.search("q")).toEqual([]);
  });

  it("returns [] when query.search is missing", async () => {
    const p = new WikipediaFloorProvider({ fetchImpl: fetchReturning({ json: { query: {} } }) });
    expect(await p.search("q")).toEqual([]);
  });
});
