import { test, expect } from "@playwright/test";

// TCK-HF2W-A2: the U+1F5D1 trash emoji on each Research thread's delete button
// (ResearchIndex.tsx) is replaced with an inline <svg> icon in the same register
// as WikiIndex's Chevron / DetailsColumn's Sparkle+Dismiss icons (viewBox
// 0 0 16 16, stroke=currentColor, aria-hidden, focusable=false). The button's
// aria-label + title must stay byte-unchanged; the control stays clickable and
// inherits the .trash colour token (--muted -> --accent-deep on hover).
//
// GATE SHAPE:
//   The delete button only mounts when a thread has a sibling (the guard is
//   `onDelete && threads.length > 1`). But the e2e seed starts Research EMPTY —
//   threads are created at runtime by real (provider-backed, non-deterministic,
//   not-gate-reachable) AI calls (see src/lib/db/seed.ts §6). So, exactly like
//   A1's dismiss-icon gate (a1WikiGlyphSvg.spec.ts) and wikiFreshColour.spec.ts,
//   we assert the shipped source of truth the chunk is built from rather than a
//   mounted element: TrashIcon is defined, wired into the aria-labelled +
//   titled delete <button>, decorative, and the old emoji glyph is gone.

test("research delete button ships an inline SVG (TrashIcon) wired to the aria-labelled + titled button", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const src = readFileSync(
    join(process.cwd(), "src/components/research/ResearchIndex.tsx"),
    "utf8",
  );

  // The delete button keeps BOTH its accessible name carriers byte-unchanged
  // (aria-label templated on the thread title, and the static title tooltip),
  // and now renders the SVG icon instead of the emoji glyph.
  expect(src).toMatch(/aria-label=\{`Delete thread "\$\{t\.title\}"`\}/);
  expect(src).toMatch(/title="Delete thread"/);
  expect(src).toMatch(/<TrashIcon\s*\/>/);

  // TrashIcon is a real inline <svg> in the shared Chevron register: decorative
  // (aria-hidden + focusable=false) and colour-inheriting (stroke=currentColor),
  // so it follows the .trash colour token on hover/active without extra CSS.
  const iconDef = /function TrashIcon\([\s\S]*?\n\}/.exec(src);
  expect(iconDef, "TrashIcon component must be defined").not.toBeNull();
  const body = (iconDef as RegExpExecArray)[0];
  expect(body).toContain("<svg");
  expect(body).toContain('viewBox="0 0 16 16"');
  expect(body).toContain('stroke="currentColor"');
  expect(body).toContain('aria-hidden="true"');
  expect(body).toContain('focusable="false"');

  // The old U+1F5D1 trash emoji glyph (surrogate pair) must be gone entirely.
  expect(src).not.toContain("\uD83D\uDDD1");
});
