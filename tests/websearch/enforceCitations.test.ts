import { describe, it, expect } from "vitest";

import { enforceCitations } from "@/lib/websearch/ground/enforceCitations";

// M7 — grounding guard. The model may only cite URLs that were actually
// retrieved. Any markdown link whose URL is NOT in the allowed set (the URLs the
// engine actually read) is a hallucinated citation and gets neutralized to its
// visible text, so the UI never shows a fabricated source link.

describe("enforceCitations", () => {
  const allowed = [
    "https://example.com/a",
    "https://docs.test/guide",
  ];

  it("keeps a citation whose URL was actually retrieved", () => {
    const out = enforceCitations("See [A](https://example.com/a).", allowed);
    expect(out).toContain("[A](https://example.com/a)");
  });

  it("strips a hallucinated citation URL, keeping its text", () => {
    const out = enforceCitations("See [fake](https://not-retrieved.test/x).", allowed);
    expect(out).not.toContain("https://not-retrieved.test/x");
    expect(out).toContain("fake");
  });

  it("matches allowed URLs ignoring a trailing slash difference", () => {
    const out = enforceCitations("[A](https://example.com/a/)", allowed);
    expect(out).toContain("[A](https://example.com/a/)");
  });

  it("keeps relative/anchor links (not citations to external sources)", () => {
    const out = enforceCitations("[here](#section) and [rel](/local)", allowed);
    expect(out).toContain("(#section)");
    expect(out).toContain("(/local)");
  });

  it("neutralizes ALL hallucinated links when the allowed set is empty", () => {
    const out = enforceCitations("[x](https://a.test) [y](https://b.test)", []);
    expect(out).not.toContain("https://a.test");
    expect(out).not.toContain("https://b.test");
    expect(out).toContain("x");
    expect(out).toContain("y");
  });
});
