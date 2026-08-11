import { describe, it, expect } from "vitest";

import {
  renderWebContext,
  collectAllowedUrls,
} from "@/lib/research/webSearchAdapter";
import type { RetrievalResult } from "@/lib/websearch/types";

// M9 — app-side adapter seam. The route runs the portable engine's `retrieve`,
// then these PURE helpers convert its RetrievalResult into (a) a prompt-context
// block appended to the user message and (b) the allowed-citation URL set. This
// is the ONLY place engine types meet the app; the helpers import engine types
// but no engine runtime.

function retrieval(read: RetrievalResult["read"]): RetrievalResult {
  return { query: "q", results: [], read };
}

describe("renderWebContext", () => {
  it("returns empty string when nothing was read (falls back to wiki-only)", () => {
    expect(renderWebContext(retrieval([]))).toBe("");
  });

  it("renders each read page's url, title, and full-body markdown", () => {
    const block = renderWebContext(
      retrieval([
        { url: "https://a.test/x", title: "Alpha", markdown: "Alpha body **content**." },
        { url: "https://b.test/y", title: "Beta", markdown: "Beta body content." },
      ]),
    );
    expect(block).toContain("https://a.test/x");
    expect(block).toContain("Alpha");
    expect(block).toContain("Alpha body **content**.");
    expect(block).toContain("https://b.test/y");
    expect(block).toContain("Beta body content.");
  });

  it("includes the full body without truncating long pages", () => {
    const long = Array.from({ length: 500 }, (_, i) => `line ${i}`).join(" ");
    const block = renderWebContext(
      retrieval([{ url: "https://a.test", title: "T", markdown: long }]),
    );
    expect(block).toContain("line 0");
    expect(block).toContain("line 499");
  });
});

describe("collectAllowedUrls", () => {
  it("returns the URLs of every read page", () => {
    const urls = collectAllowedUrls(
      retrieval([
        { url: "https://a.test/x", title: "A", markdown: "m" },
        { url: "https://b.test/y", title: "B", markdown: "m" },
      ]),
    );
    expect(urls).toEqual(["https://a.test/x", "https://b.test/y"]);
  });

  it("returns an empty array when nothing was read", () => {
    expect(collectAllowedUrls(retrieval([]))).toEqual([]);
  });
});
