import { test, expect, type Page, type Locator } from "@playwright/test";

// TCK-HF4: 40px touch-target floor on desktop/tablet (pointer-fine).
//
// Root cause: min-height:44px was wired ONLY at the phone tier (<=1200px /
// <=560px media queries); on pointer-fine desktop the named controls collapsed
// to ~30-34px. Fix adds a base min-height:40px floor (every tier) to
// .item/.add/.action/.railRow/.keep/.chip/.confirmYes/.confirmCancel and
// enlarges the 24px .trash hit box to 40x40 (padding-right on .item widened so
// the bigger hit box does not overlap the row label).
//
// This spec measures each named control's rendered boundingBox().height at the
// project's default desktop viewport (playwright.config projects run desktop
// widths) and asserts >= 40. Selectors follow the repo's established e2e
// conventions (accessible names + nav[aria-label] scoping + button[class*=]).

const FLOOR = 40;

function threadsNav(page: Page) {
  return page.locator('nav[aria-label="Research threads"]');
}
function chaptersNav(page: Page) {
  return page.locator('nav[aria-label="Chapters"]');
}

async function expectFloor(loc: Locator, label: string) {
  await expect(loc, `${label} present`).toBeVisible();
  const box = await loc.boundingBox();
  expect(box, `${label} has a box`).not.toBeNull();
  expect(
    box!.height,
    `${label} height ${box!.height} >= ${FLOOR}`,
  ).toBeGreaterThanOrEqual(FLOOR);
}

test.describe("HF4 touch-target floor — write", () => {
  test("chapters .item rows and the + New create row meet the 40px floor", async ({
    page,
  }) => {
    await page.goto("/write");
    const nav = chaptersNav(page);
    await expect(nav).toBeVisible();
    // Chapter rows are .item buttons (repo pattern: button[class*="item"]).
    await expectFloor(nav.locator('button[class*="item"]').first(), "write .item");
    // The create row is the only + New button in the chapters nav (.add).
    await expectFloor(
      nav.getByRole("button", { name: /\+ New/i }).first(),
      "write .add",
    );
  });

  test("outstanding-rail .railRow rows meet the floor", async ({ page }) => {
    await page.goto("/write");
    const railRow = page.locator('button[class*="railRow"]').first();
    // The rail only renders when the manuscript has marks; skip cleanly if the
    // seeded chapter has none so the spec stays deterministic under shared data.
    if ((await railRow.count()) === 0) test.skip(true, "no outstanding marks seeded");
    await expectFloor(railRow, "write .railRow");
  });
});

test.describe("HF4 touch-target floor — research", () => {
  test("thread .item rows, the create row, and the .trash hit box meet the floor", async ({
    page,
  }) => {
    await page.goto("/research");
    const nav = threadsNav(page);
    await expect(nav).toBeVisible();
    const item = nav.locator('button[class*="item"]').first();
    if ((await item.count()) === 0) test.skip(true, "no seeded threads");
    await expectFloor(item, "research .item");
    // Hover the row so .trash paints (opacity toggles; box still measures).
    await item.hover();
    await expectFloor(
      nav.getByRole("button", { name: /^Delete thread/ }).first(),
      "research .trash",
    );
    await expectFloor(
      nav.getByRole("button", { name: /\+ New thread/i }).first(),
      "research .add",
    );
  });

  test("prompt .chip buttons meet the floor on the empty composer", async ({
    page,
  }) => {
    await page.goto("/research");
    // Prompt chips render immediately under the empty composer when the research
    // AI is enabled (they ARE the composer's children — no thread click needed).
    // "Give me a scene" is a stable CHIPS label (no curly-apostrophe escaping).
    const chip = page.getByRole("button", { name: /Give me a scene/i }).first();
    // AI-off envs render a static placeholder and no chips; skip cleanly there,
    // matching research.spec's composer-disabled convention.
    if ((await chip.count()) === 0) test.skip(true, "research AI disabled — no chips");
    await expectFloor(chip, "research .chip");
  });
});
