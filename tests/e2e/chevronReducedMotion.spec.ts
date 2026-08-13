import { test, expect } from "@playwright/test";

// TCK-HF7: the wiki disclosure chevron (the rail-toggle / group-toggle SVG) has a
// `transition: transform 120ms ease` tween. Under `prefers-reduced-motion: reduce`
// that tween must be suppressed so the glyph SNAPS to its open/closed angle. The
// 90deg end-state (`.chevronOpen svg{transform:rotate(90deg)}`) STAYS — it encodes
// state, not motion; only the animated transition is removed.
//
// LOCATOR NOTE: CSS-module class names are hashed at build time, so a raw
// `.railToggleChevron` selector matches nothing in the built DOM. We therefore
// locate the chevron structurally: the rail-toggle is a real <button> whose
// accessible name is "The world <n> entries"; its inner <svg> is the chevron.
// The rail-toggle chevron is `display:none` on desktop and only shown at
// <=1200px (it's the stacked-tier disclosure control), so the spec uses a
// 1024px viewport to render it. We assert the locator resolves (toBeVisible)
// BEFORE reading duration, so the test can never pass vacuously against zero
// elements. transition-duration is inherited from the same rule regardless of
// width, so measuring at the tier where the control is visible is faithful.

async function chevronSvg(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/wiki");
  await page.waitForLoadState("networkidle");
  const railToggle = page.getByRole("button", { name: /The world/i }).first();
  await expect(railToggle).toBeVisible();
  const svg = railToggle.locator("svg").first();
  await expect(svg).toBeVisible();
  return svg;
}

test.describe("wiki chevron honours prefers-reduced-motion", () => {
  test("reduced-motion: chevron transition-duration is 0s (snaps)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const svg = await chevronSvg(page);
    const duration = await svg.evaluate(
      (el) => getComputedStyle(el as Element).transitionDuration,
    );
    expect(
      duration,
      "under reduced-motion the chevron tween must be removed (transition:none)",
    ).toBe("0s");
  });

  test("no-preference: chevron keeps its 120ms transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const svg = await chevronSvg(page);
    const duration = await svg.evaluate(
      (el) => getComputedStyle(el as Element).transitionDuration,
    );
    // 120ms base transition (transition: transform 120ms ease) is preserved for
    // users who did not ask for reduced motion.
    expect(
      duration,
      "with no motion preference the chevron keeps its 120ms tween",
    ).toBe("0.12s");
  });
});
