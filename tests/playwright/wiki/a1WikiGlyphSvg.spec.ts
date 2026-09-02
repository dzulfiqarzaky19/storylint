import { test, expect } from "@playwright/test";

// TCK-HF2W-A1: the two text glyphs in the wiki DetailsColumn AI block — the
// U+2726 sparkle on the "Suggest details" button and the U+2715 x on each
// suggestion's dismiss button — are replaced with inline <svg> icons in the same
// register as WikiIndex's Chevron (viewBox 0 0 16 16, stroke=currentColor,
// aria-hidden, focusable=false). The visible label text and the dismiss
// aria-label must stay byte-unchanged; the controls stay clickable.
//
// GATE SHAPE:
//   * The "Suggest details" button renders on /wiki at load (no AI call needed),
//     so its sparkle SVG is asserted LIVE in the DOM.
//   * The per-suggestion dismiss button only mounts once live AI suggestions
//     exist (a provider-backed, non-deterministic, not-gate-reachable path — the
//     same reason wikiFreshColour.spec.ts asserts the shipped artifact rather
//     than a mounted element). So we assert the shipped component chunk carries
//     the DismissIcon <svg> wired to the dismiss button, with the aria-label
//     intact — the bytes the browser downloads once the row renders.

test("wiki 'Suggest details' button renders an inline SVG sparkle, not a font glyph", async ({
  page,
}) => {
  await page.goto("/wiki");
  await page.waitForLoadState("networkidle");

  const suggest = page.getByRole("button", { name: /Suggest details/i });
  await expect(suggest).toBeVisible();

  // The accessible/visible label text is unchanged.
  await expect(suggest).toHaveText(/Suggest details/);

  // It contains a real inline <svg> icon (not a ✦ text glyph).
  const svg = suggest.locator("svg");
  await expect(svg).toHaveCount(1);

  // The glyph is decorative + inherits colour (matches the Chevron register).
  await expect(svg).toHaveAttribute("aria-hidden", "true");
  const stroke = await svg.evaluate((el) => el.getAttribute("stroke"));
  expect(stroke).toBe("currentColor");

  // The old sparkle text glyph must not appear as button text.
  const text = (await suggest.textContent()) ?? "";
  expect(text).not.toContain("\u2726"); // ✦
});

test("dismiss control ships an inline SVG (DismissIcon) wired to the aria-labelled button", () => {
  // Assert the source of truth the chunk is built from: DetailsColumn renders a
  // <DismissIcon/> inside the aria-labelled dismiss <button>, and the icon SVG is
  // decorative (aria-hidden, focusable=false, stroke=currentColor). This is the
  // gate-reachable proof for the non-deterministic suggestion row.
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const src = readFileSync(
    join(process.cwd(), "src/components/wiki/entry/DetailsColumn.tsx"),
    "utf8",
  );

  // The dismiss button keeps its aria-label and now renders the SVG icon.
  expect(src).toMatch(/aria-label=\{`Dismiss \$\{s\.key\}`\}/);
  expect(src).toMatch(/<DismissIcon\s*\/>/);

  // DismissIcon is a real inline <svg> in the Chevron register.
  const iconDef = /function DismissIcon\([\s\S]*?\n\}/.exec(src);
  expect(iconDef, "DismissIcon component must be defined").not.toBeNull();
  const body = (iconDef as RegExpExecArray)[0];
  expect(body).toContain("<svg");
  expect(body).toContain('stroke="currentColor"');
  expect(body).toContain('aria-hidden="true"');
  expect(body).toContain('focusable="false"');
  // No leftover ✕ text glyph anywhere in the component.
  expect(src).not.toContain("\u2715"); // ✕
});
