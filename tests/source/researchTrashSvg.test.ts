import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Migrated from e2e `research/a2ResearchTrashSvg.spec.ts` (TCK-HF2W-A2). The old
// spec started `import { test } from "@playwright/test"` but drove NO browser at
// all — it only readFileSync'd ResearchIndex.tsx and asserted on the source. So
// it is a source-golden check, not an e2e journey; it belongs in the DB-free
// unit tier and needs neither a live server nor Postgres.
//
// What it locks: the Research thread delete button ships an inline <svg>
// (TrashIcon) in the shared Chevron register, keeps BOTH accessible-name carriers
// (aria-label + title) byte-unchanged, and no longer renders the U+1F5D1 emoji.

const src = readFileSync(
  join(process.cwd(), "src/components/research/ResearchIndex.tsx"),
  "utf8",
);

describe("research delete button ships an inline SVG (TrashIcon)", () => {
  it("keeps both accessible-name carriers and renders the icon, not an emoji", () => {
    expect(src).toMatch(/aria-label=\{`Delete thread "\$\{t\.title\}"`\}/);
    expect(src).toMatch(/title="Delete thread"/);
    expect(src).toMatch(/<TrashIcon\s*\/>/);
  });

  it("defines TrashIcon as a decorative, colour-inheriting inline svg", () => {
    const iconDef = /function TrashIcon\([\s\S]*?\n\}/.exec(src);
    expect(iconDef, "TrashIcon component must be defined").not.toBeNull();
    const body = (iconDef as RegExpExecArray)[0];
    expect(body).toContain("<svg");
    expect(body).toContain('viewBox="0 0 16 16"');
    expect(body).toContain('stroke="currentColor"');
    expect(body).toContain('aria-hidden="true"');
    expect(body).toContain('focusable="false"');
  });

  it("drops the old U+1F5D1 trash emoji glyph entirely", () => {
    expect(src).not.toContain("\uD83D\uDDD1");
  });
});
