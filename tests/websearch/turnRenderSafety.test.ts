import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// M10 — render guard-rail for the DOMPurify-free / jsdom-free reader.
//
// The web-search reader deliberately does NOT sanitize HTML (it emits markdown
// text-for-LLM). The safety argument depends on the research turn text being
// rendered as ESCAPED React text, never as raw HTML. If Turn.tsx ever switched
// to dangerouslySetInnerHTML, extracted page content (which may contain <script>
// or an onerror attribute) could execute. This test locks that render contract:
// Turn renders {turn.text} as JSX text and uses no dangerouslySetInnerHTML.

const TURN = join(process.cwd(), "src", "components", "research", "Turn.tsx");

describe("Turn render safety contract", () => {
  const src = readFileSync(TURN, "utf8");

  it("renders the turn text as escaped JSX ({turn.text})", () => {
    expect(src).toContain("{turn.text}");
  });

  it("never uses dangerouslySetInnerHTML for turn content", () => {
    expect(src).not.toContain("dangerouslySetInnerHTML");
  });
});
