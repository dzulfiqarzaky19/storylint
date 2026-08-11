import { describe, it, expect } from "vitest";

import { readPage } from "@/lib/websearch/read/reader";
import type { SafeFetchResult } from "@/lib/websearch/read/safeFetch";

// M6 — full-body reader. safeFetch -> linkedom parseHTML -> defuddle markdown.
// FULL body (no truncation/compaction). null when there's nothing to read
// (empty extraction) so the caller falls back to the search snippet.

function fetchStub(body: string, url = "https://x.test/page") {
  return async (): Promise<SafeFetchResult> => ({
    url,
    status: 200,
    contentType: "text/html",
    body,
  });
}

// A long article whose distinctive sentinel sits LATE in the body — proves the
// reader keeps the whole document, not just a head/summary slice.
const LATE_SENTINEL = "ZQX-END-OF-ARTICLE-MARKER";
const LONG_HTML =
  "<html><head><title>Big Page</title></head><body><article><h1>Heading</h1>" +
  Array.from({ length: 200 }, (_, i) => `<p>Paragraph number ${i} with several words of prose content here.</p>`).join("") +
  `<p>${LATE_SENTINEL}</p></article></body></html>`;

describe("readPage", () => {
  it("returns full-body markdown including content late in the document", async () => {
    const res = await readPage("https://x.test/page", { safeFetchImpl: fetchStub(LONG_HTML) });
    expect(res).not.toBeNull();
    expect(res?.markdown).toContain(LATE_SENTINEL);
    expect(res?.markdown).toContain("Paragraph number 5");
    // Length band: a real extraction of a 200-paragraph article is substantial.
    expect((res?.markdown.length ?? 0)).toBeGreaterThan(2000);
  });

  it("keeps the whole body (no truncation): early AND late paragraphs both present", async () => {
    const res = await readPage("https://x.test/page", { safeFetchImpl: fetchStub(LONG_HTML) });
    expect(res?.markdown).toContain("Paragraph number 0");
    expect(res?.markdown).toContain("Paragraph number 199");
  });

  it("carries the post-redirect final url and title", async () => {
    const res = await readPage("https://x.test/page", { safeFetchImpl: fetchStub(LONG_HTML) });
    expect(res?.url).toBe("https://x.test/page");
    expect(res?.title.length).toBeGreaterThan(0);
  });

  it("returns null when extraction yields empty content (snippet fallback)", async () => {
    const res = await readPage("https://x.test/empty", {
      safeFetchImpl: fetchStub("<html><head><title>Empty</title></head><body></body></html>"),
    });
    expect(res).toBeNull();
  });

  it("returns null when safeFetch throws (fail-soft)", async () => {
    const res = await readPage("https://blocked.test", {
      safeFetchImpl: async () => {
        throw new Error("UnsafeUrlError: private IP");
      },
    });
    expect(res).toBeNull();
  });
});
