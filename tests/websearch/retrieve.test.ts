import { describe, it, expect } from "vitest";

import { retrieve } from "@/lib/websearch/retrieve";
import type { SearchResult, ReadResult } from "@/lib/websearch/types";

// M8 — engine entrypoint. Composes search -> read top-N -> ground, returning a
// RetrievalResult. Fully injectable + fail-soft: a search failure yields an
// empty result; a single read failure drops that page but never sinks the run;
// read markdown is passed through the output-boundary sanitizer.

function res(url: string, title = "t", snippet = "s"): SearchResult {
  return { url, title, snippet, source: "test" };
}

describe("retrieve", () => {
  it("returns query, search results, and full-body reads", async () => {
    const results = [res("https://a.test/1"), res("https://b.test/2")];
    const out = await retrieve("hello", {
      searchImpl: async () => results,
      readImpl: async (url) => ({ url, title: "T", markdown: `body of ${url}` }),
      maxRead: 5,
    });
    expect(out.query).toBe("hello");
    expect(out.results).toEqual(results);
    expect(out.read.map((r) => r.url)).toEqual(["https://a.test/1", "https://b.test/2"]);
    expect(out.read[0]?.markdown).toContain("body of https://a.test/1");
  });

  it("reads at most maxRead pages even when more results are returned", async () => {
    const results = [res("https://a/1"), res("https://a/2"), res("https://a/3")];
    let reads = 0;
    const out = await retrieve("q", {
      searchImpl: async () => results,
      readImpl: async (url) => {
        reads += 1;
        return { url, title: "t", markdown: "x" };
      },
      maxRead: 2,
    });
    expect(reads).toBe(2);
    expect(out.read).toHaveLength(2);
  });

  it("drops a page whose read returns null but keeps the others (fail-soft)", async () => {
    const results = [res("https://ok.test"), res("https://bad.test")];
    const out = await retrieve("q", {
      searchImpl: async () => results,
      readImpl: async (url) => (url.includes("bad") ? null : { url, title: "t", markdown: "ok" }),
      maxRead: 5,
    });
    expect(out.read.map((r) => r.url)).toEqual(["https://ok.test"]);
  });

  it("survives a read that throws, keeping the surviving pages", async () => {
    const results = [res("https://ok.test"), res("https://throw.test")];
    const out = await retrieve("q", {
      searchImpl: async () => results,
      readImpl: async (url) => {
        if (url.includes("throw")) throw new Error("boom");
        return { url, title: "t", markdown: "ok" };
      },
      maxRead: 5,
    });
    expect(out.read.map((r) => r.url)).toEqual(["https://ok.test"]);
  });

  it("returns empty results and reads when search throws (fail-soft)", async () => {
    const out = await retrieve("q", {
      searchImpl: async () => {
        throw new Error("search down");
      },
      readImpl: async () => ({ url: "x", title: "t", markdown: "x" }),
      maxRead: 5,
    });
    expect(out.results).toEqual([]);
    expect(out.read).toEqual([]);
  });

  it("sanitizes read markdown at the output boundary (strips javascript: links)", async () => {
    const out = await retrieve("q", {
      searchImpl: async () => [res("https://a.test")],
      readImpl: async (url): Promise<ReadResult> => ({
        url,
        title: "t",
        markdown: "danger [x](javascript:alert(1)) end",
      }),
      maxRead: 5,
    });
    expect(out.read[0]?.markdown).not.toContain("javascript:");
    expect(out.read[0]?.markdown).toContain("end");
  });
});
