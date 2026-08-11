import { describe, it, expect } from "vitest";

import { sanitizeMarkdown } from "@/lib/websearch/ground/sanitizeMarkdown";

// M7 — OUTPUT-boundary XSS control. The reader is deliberately DOMPurify-free
// and jsdom-free; ALL scheme filtering happens HERE, on the markdown, before it
// reaches the model/UI. A markdown link/image whose URL uses a dangerous scheme
// (javascript:, data:, vbscript:, file:) is neutralized; http/https/relative
// survive untouched.

describe("sanitizeMarkdown", () => {
  it("neutralizes a javascript: link URL", () => {
    const out = sanitizeMarkdown("click [here](javascript:alert(1)) now");
    expect(out).not.toContain("javascript:");
    // The visible link TEXT is preserved; only the dangerous href is stripped.
    expect(out).toContain("here");
  });

  it("neutralizes a JavaScript: link URL case-insensitively (and with leading spaces)", () => {
    const out = sanitizeMarkdown("[x](  JaVaScRiPt:alert(1))");
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("neutralizes a data: image URL", () => {
    const out = sanitizeMarkdown("![alt](data:text/html;base64,PHNjcmlwdD4=)");
    expect(out).not.toContain("data:text/html");
  });

  it("neutralizes vbscript: and file: schemes", () => {
    const out = sanitizeMarkdown("[a](vbscript:msgbox) [b](file:///etc/passwd)");
    expect(out.toLowerCase()).not.toContain("vbscript:");
    expect(out.toLowerCase()).not.toContain("file:");
  });

  it("preserves safe http/https link URLs untouched", () => {
    const src = "see [docs](https://example.com/a?b=1#c) and [http](http://x.test/p)";
    const out = sanitizeMarkdown(src);
    expect(out).toContain("https://example.com/a?b=1#c");
    expect(out).toContain("http://x.test/p");
  });

  it("preserves relative and anchor link URLs", () => {
    const src = "[rel](/path/page) [anchor](#section)";
    const out = sanitizeMarkdown(src);
    expect(out).toContain("(/path/page)");
    expect(out).toContain("(#section)");
  });

  it("leaves non-link prose containing the word javascript untouched", () => {
    const out = sanitizeMarkdown("I love javascript as a language.");
    expect(out).toBe("I love javascript as a language.");
  });
});
