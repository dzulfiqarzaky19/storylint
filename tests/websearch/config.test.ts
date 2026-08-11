import { describe, it, expect } from "vitest";

import { loadWebSearchConfig } from "@/lib/websearch/search/config";

// M1: config derivation from env. The engine is portable — it takes a plain
// record (not process.env directly) so tests need no global mutation.

describe("loadWebSearchConfig", () => {
  it("is disabled with null searxngUrl when the env var is unset", () => {
    const cfg = loadWebSearchConfig({});
    expect(cfg.searxngUrl).toBeNull();
    expect(cfg.enabled).toBe(false);
  });

  it("is disabled when the url is present but blank/whitespace", () => {
    const cfg = loadWebSearchConfig({ WEBSEARCH_SEARXNG_URL: "   " });
    expect(cfg.searxngUrl).toBeNull();
    expect(cfg.enabled).toBe(false);
  });

  it("enables and trims the url when a real value is present", () => {
    const cfg = loadWebSearchConfig({
      WEBSEARCH_SEARXNG_URL: "  https://searx.example.com/  ",
    });
    expect(cfg.searxngUrl).toBe("https://searx.example.com");
    expect(cfg.enabled).toBe(true);
  });

  it("defaults numeric tunables when unset", () => {
    const cfg = loadWebSearchConfig({});
    expect(cfg.fetchTimeoutMs).toBe(8000);
    expect(cfg.maxBytes).toBe(5 * 1024 * 1024);
    expect(cfg.maxResults).toBe(5);
  });

  it("parses numeric tunables from env and ignores garbage", () => {
    const cfg = loadWebSearchConfig({
      WEBSEARCH_TIMEOUT_MS: "3000",
      WEBSEARCH_MAX_BYTES: "1048576",
      WEBSEARCH_MAX_RESULTS: "not-a-number",
    });
    expect(cfg.fetchTimeoutMs).toBe(3000);
    expect(cfg.maxBytes).toBe(1048576);
    // garbage falls back to the default rather than NaN
    expect(cfg.maxResults).toBe(5);
  });
});
