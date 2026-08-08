import { test, expect } from "@playwright/test";

// Phase 8 smoke (HANDOFF §8). Not exhaustive — proves each screen mounts,
// renders real seeded data, and the load-bearing interactions fire, at the
// canonical 1440×900 frame. Assumes a seeded DB and the app on baseURL.

test("wiki renders seeded entries with draggable tiles", async ({ page }) => {
  await page.goto("/wiki");
  await expect(page.getByText("Maren", { exact: false }).first()).toBeVisible();
  // Draggable tiles exist (native HTML5 DnD handles).
  const draggables = page.locator("[draggable='true']");
  expect(await draggables.count()).toBeGreaterThan(3);
});

test("research: Keep inverts and 'Make it an entry' reveals the confirmation strip", async ({
  page,
}) => {
  await page.goto("/research");
  await expect(
    page.getByText("If a salt-name is a debt", { exact: false }),
  ).toBeVisible();

  // Keep toggles to Kept.
  const keep = page.getByRole("button", { name: "Keep", exact: true }).first();
  await keep.click();
  await expect(
    page.getByRole("button", { name: "Kept", exact: true }).first(),
  ).toBeVisible();

  // The confirmation strip must NOT be present until a card is made an entry.
  await expect(page.getByText("Yes, write it in", { exact: false })).toHaveCount(0);

  // Make it an entry -> the strip (the only wiki-write path) appears.
  await page
    .getByRole("button", { name: "Make it an entry", exact: true })
    .first()
    .click();
  await expect(page.getByText("Yes, write it in", { exact: false })).toBeVisible();

  // Cancel writes nothing and hides the strip again.
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Yes, write it in", { exact: false })).toHaveCount(0);
});

test("write: manuscript renders with engine underline decorations and the rail", async ({
  page,
}) => {
  await page.goto("/write");
  // Real seeded manuscript text (may appear both as body text and inside an
  // underline decoration span, so match the first).
  await expect(
    page.getByText("nineteen and sworn", { exact: false }).first(),
  ).toBeVisible();
  // Promise block copy.
  await expect(
    page.getByText("Nothing enters the gazetteer until you write it in.", {
      exact: false,
    }),
  ).toBeVisible();
  // The engine ran: at least one underline decoration is present in the DOM
  // (contradiction = solid, unrecorded = dotted; both use these global classes).
  const underlines = page.locator(
    ".write-underline-conflict, .write-underline-unrecorded",
  );
  await expect(underlines.first()).toBeVisible();
  expect(await underlines.count()).toBeGreaterThan(0);
});

test("write: rail stacks below the manuscript at <=1200px", async ({ page }) => {
  await page.goto("/write");
  const manuscript = page.getByText("nineteen and sworn", { exact: false }).first();
  const rail = page.getByText("Nothing enters the gazetteer until you write it in.", {
    exact: false,
  });
  await expect(manuscript).toBeVisible();

  // At 1440 the rail sits to the RIGHT of the manuscript (higher x, similar y band).
  await page.setViewportSize({ width: 1440, height: 900 });
  const wideRail = await rail.boundingBox();
  const wideMs = await manuscript.boundingBox();
  expect(wideRail && wideMs && wideRail.x).toBeGreaterThan(wideMs!.x);

  // At 1100 the rail moves BELOW (greater y) — stacked, not shrunk.
  await page.setViewportSize({ width: 1100, height: 900 });
  const narrowRail = await rail.boundingBox();
  const narrowMs = await manuscript.boundingBox();
  expect(narrowRail && narrowMs && narrowRail.y).toBeGreaterThan(narrowMs!.y);
});
