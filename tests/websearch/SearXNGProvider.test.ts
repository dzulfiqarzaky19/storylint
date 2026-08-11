import { describe, it, expect } from "vitest";

import { SearXNGProvider } from "@/lib/websearch/search/SearXNGProvider";

// M4 — SearXNG JSON provider. Parses format=json; returns [] (never throws) on
// 403 / non-JSON / timeout / network error so the compose layer falls through.
// The SearXNG base URL is OPERATOR-configured (trusted), so this uses a plain
// injectable fetch seam — not the SSRF safeFetch (that guards user-chosen page
// reads, M6).

// A trimmed but realistic SearXNG /search?format=json body.
const REAL_JSON = {
  query: "dragons",
  number_of_results: 2,
  results: [
    {
      url: "https://en.wikipedia.org/wiki/Dragon",
      title: "Dragon - Wikipedia",
      content: "A dragon is a large magical legendary creature...",
      engine: "wikipedia",
    },
    {
      url: "https://example.com/dragons",
      title: "All About Dragons",
      content: "Everything you wanted to know.",
      engines: ["google", "bing"],
    },
  ],
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

describe("SearXNGProvider", () => {
  it("has a stable name", () => {
    const p = new SearXNGProvider("https://searx.test", { fetchImpl: fetchReturning({ json: REAL_JSON }) });
    expect(p.name).toBe("searxng");
  });

  it("parses format=json results into SearchResult[]", async () => {
    const p = new SearXNGProvider("https://searx.test", {
      fetchImpl: fetchReturning({ json: REAL_JSON }),
    });
    const out = await p.search("dragons");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      url: "https://en.wikipedia.org/wiki/Dragon",
      title: "Dragon - Wikipedia",
      snippet: "A dragon is a large magical legendary creature...",
      source: "searxng",
    });
    expect(out[1]?.url).toBe("https://example.com/dragons");
  });

  it("requests the configured base with q and format=json", async () => {
    let seen = "";
    const p = new SearXNGProvider("https://searx.test/", {
      fetchImpl: async (url: string) => {
        seen = url;
        return new Response(JSON.stringify(REAL_JSON), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    await p.search("fire drakes");
    expect(seen).toContain("https://searx.test/search");
    expect(seen).toContain("format=json");
    expect(seen).toContain("q=fire%20drakes");
  });

  it("drops results with a non-http(s) url (defense in depth)", async () => {
    const p = new SearXNGProvider("https://searx.test", {
      fetchImpl: fetchReturning({
        json: { results: [{ url: "javascript:alert(1)", title: "x", content: "y" }] },
      }),
    });
    expect(await p.search("q")).toEqual([]);
  });

  it("returns [] on a 403 (rate-limited / blocked) even when the body is valid JSON results", async () => {
    const p = new SearXNGProvider("https://searx.test", {
      // Body is parseable results; ONLY the status guard must reject it.
      fetchImpl: fetchReturning({ status: 403, json: REAL_JSON }),
    });
    expect(await p.search("q")).toEqual([]);
  });

  it("returns [] on a non-JSON body (HTML error page)", async () => {
    const p = new SearXNGProvider("https://searx.test", {
      fetchImpl: fetchReturning({ text: "<html>error</html>", contentType: "text/html" }),
    });
    expect(await p.search("q")).toEqual([]);
  });

  it("returns [] on a thrown network/timeout error (never propagates)", async () => {
    const p = new SearXNGProvider("https://searx.test", {
      fetchImpl: fetchReturning({ throwErr: new Error("AbortError: timed out") }),
    });
    expect(await p.search("q")).toEqual([]);
  });

  it("returns [] when results is missing or not an array", async () => {
    const p = new SearXNGProvider("https://searx.test", {
      fetchImpl: fetchReturning({ json: { number_of_results: 0 } }),
    });
    expect(await p.search("q")).toEqual([]);
  });
});
