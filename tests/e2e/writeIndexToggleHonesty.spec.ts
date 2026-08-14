import { test, expect } from "@playwright/test";

// TCK-HF2W-B1: the Write LEFT index header (.railToggle) must not LIE to
// assistive tech. Above 1200px the chapter `.panel` is ALWAYS shown (see
// WriteIndex.module.css: .panel display:flex base, display:none only inside
// @media(max-width:1200px)). Yet the header was ALWAYS rendered as a
// `<button aria-expanded={open}>` — on desktop that is a focusable no-op button
// announcing "collapsed" while the panel it "controls" is fully visible. That
// aria-expanded is a lie.
//
// FIX: gate the interactive semantics to the collapse tier. At >1200px render a
// plain, non-interactive heading (no button role, no aria-expanded/controls, not
// tab-focusable). At <=1200px render the working toggle. Panel show/hide is NOT
// touched — only the header element's semantics.
//
// WHY THIS SHAPE (non-vacuous): the honesty bug is a real-browser, breakpoint-
// driven fact (matchMedia only resolves live), so this is an e2e gate at two
// real widths. The mutation the gate must catch is dropping the breakpoint
// branch (always-button) or dropping the aria-expanded gate.

const HEADER = 'nav[aria-label="Chapters"]';

test.describe("Write index toggle affordance honesty", () => {
  test("desktop (1440px): header is a plain heading, NOT a lying aria-expanded button", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/write");

    const nav = page.locator(HEADER);
    await expect(nav).toBeVisible();

    // The panel is shown on desktop.
    const panel = nav.locator("ul");
    await expect(panel).toBeVisible();

    // No focusable no-op toggle: the header must NOT be a button carrying a
    // (false) aria-expanded while the panel is open. THIS is the line the
    // desktop-branch mutation reintroduces.
    const lyingToggle = nav.locator("button[aria-expanded]");
    await expect(lyingToggle).toHaveCount(0);

    // The "Chapters" header text is still present, as a heading (announced as a
    // heading to AT, not a collapsed button).
    const heading = nav.getByRole("heading", { name: /chapters/i });
    await expect(heading).toBeVisible();
  });

  test("collapse tier (768px): header IS a working aria-expanded toggle", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/write");

    const nav = page.locator(HEADER);
    await expect(nav).toBeVisible();

    // The interactive toggle exists and honestly starts collapsed.
    const toggle = nav.locator("button[aria-expanded]");
    await expect(toggle).toHaveCount(1);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Panel starts hidden (folded) in this tier.
    const panelId = await toggle.getAttribute("aria-controls");
    expect(panelId, "toggle must point at the panel it controls").toBeTruthy();
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toBeHidden();

    // Activating it reveals the panel and flips aria-expanded honestly.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
  });
});
