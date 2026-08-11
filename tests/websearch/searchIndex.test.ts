import { describe, it, expect } from "vitest";

import { composeSearch, buildProviders } from "@/lib/websearch/search/index";
import type { SearchProvider, SearchResult } from "@/lib/websearch/types";
import { loadWebSearchConfig } from "@/lib/websearch/search/config";

// M5 — compose layer. Runs providers in order and returns the FIRST non-empty
// result set (SearXNG primary, Wikipedia floor as fallback). Never throws.

function stub(name: string, results: SearchResult[], opts: { throws?: boolean } = {}): SearchProvider {
  return {
    name,
    search: async () => {
      if (opts.throws) throw new Error(`${name} exploded`);
      return results;
    },
  };
}

const A: SearchResult = { url: "https://a.test", title: "A", snippet: "", source: "primary" };
const B: SearchResult = { url: "https://b.test", title: "B", snippet: "", source: "floor" };

describe("composeSearch", () => {
  it("returns the primary provider's results when it has any", async () => {
    const out = await composeSearch("q", [stub("primary", [A]), stub("floor", [B])]);
    expect(out).toEqual([A]);
  });

  it("falls through to the next provider when the first is empty", async () => {
    const out = await composeSearch("q", [stub("primary", []), stub("floor", [B])]);
    expect(out).toEqual([B]);
  });

  it("falls through when a provider THROWS (treats it as empty)", async () => {
    const out = await composeSearch("q", [stub("primary", [], { throws: true }), stub("floor", [B])]);
    expect(out).toEqual([B]);
  });

  it("returns [] when every provider is empty", async () => {
    const out = await composeSearch("q", [stub("primary", []), stub("floor", [])]);
    expect(out).toEqual([]);
  });

  it("returns [] with no providers", async () => {
    expect(await composeSearch("q", [])).toEqual([]);
  });
});

describe("buildProviders", () => {
  it("includes SearXNG then Wikipedia when configured", () => {
    const cfg = loadWebSearchConfig({ WEBSEARCH_SEARXNG_URL: "https://searx.test" });
    const names = buildProviders(cfg).map((p) => p.name);
    expect(names).toEqual(["searxng", "wikipedia"]);
  });

  it("includes ONLY the Wikipedia floor when SearXNG is unconfigured", () => {
    const cfg = loadWebSearchConfig({});
    const names = buildProviders(cfg).map((p) => p.name);
    expect(names).toEqual(["wikipedia"]);
  });
});
