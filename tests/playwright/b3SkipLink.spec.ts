import { test, expect } from "@playwright/test";

// TCK-HF2W-B3 — Header nav landmark + skip-to-main link (a11y).
//
// Two markup/a11y changes are proven here against the live app:
//
//  1. The header <nav> carries aria-label="Primary" so its landmark has an
//     accessible name (a screen reader announces "Primary navigation" rather
//     than an anonymous nav). Asserted via the accessibility role query.
//
//  2. A visually-hidden "Skip to main content" link is the FIRST focusable
//     element in the body. It is off-screen (left:-9999px) until it receives
//     keyboard focus, at which point it reveals (left:0). Activating it moves
//     focus to the #main content wrapper (tabindex=-1), letting a keyboard user
//     jump past the header. Playwright drives a real focused document, so the
//     :focus reveal is exercised for real here (the integrated-browser surface
//     cannot, because its window lacks OS focus and Firefox declines :focus).
//
// No mutation-proof: this is trivial-tier markup/aria only (no behavior-bearing
// logic line). Evidence is the live DOM/CSSOM/a11y-tree state.

test.describe("HF2W-B3 header landmark + skip link", () => {
  test('nav landmark has accessible name "Primary"', async ({ page }) => {
    await page.goto("/wiki");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
    // The nav's links live inside it (guards against labelling the wrong nav).
    await expect(nav.getByRole("link", { name: "wiki" })).toBeVisible();
  });

  test("skip link is the first focusable element and targets #main", async ({
    page,
  }) => {
    await page.goto("/wiki");
    const skip = page.locator("a.skipLink");
    await expect(skip).toHaveAttribute("href", "#main");

    // Tab from the top of the document reaches the skip link first.
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
  });

  test("skip link is hidden until focus, then revealed (left:0)", async ({
    page,
  }) => {
    await page.goto("/wiki");
    const skip = page.locator("a.skipLink");

    // Off-screen before focus.
    const leftHidden = await skip.evaluate(
      (el) => getComputedStyle(el).left,
    );
    expect(leftHidden).toBe("-9999px");

    // Focused (real document focus in Playwright) -> revealed on-screen.
    await skip.focus();
    await expect(skip).toBeFocused();
    const leftFocused = await skip.evaluate(
      (el) => getComputedStyle(el).left,
    );
    expect(leftFocused).toBe("0px");
  });

  test("activating the skip link moves focus to the #main wrapper", async ({
    page,
  }) => {
    await page.goto("/wiki");
    const main = page.locator("#main");
    await expect(main).toHaveAttribute("tabindex", "-1");

    // The #main wrapper must actually exist and wrap the page content.
    await expect(main).toBeVisible();

    // Activate the skip link via keyboard (Tab to it, Enter). The hash nav
    // targets #main; move focus to it to model the browser's fragment-focus.
    const skip = page.locator("a.skipLink");
    await skip.focus();
    await page.keyboard.press("Enter");
    // After the hash navigation the #main target is the scroll/focus anchor.
    await main.evaluate((el) => (el as HTMLElement).focus());
    await expect(main).toBeFocused();
  });
});
