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

test("write: clicking a rail row opens the inline note and highlights the row (§7)", async ({
  page,
}) => {
  await page.goto("/write");
  const rows = page.locator("button[aria-pressed]");
  await expect(rows.first()).toBeVisible();
  // No note open initially.
  await expect(page.getByTestId("write-inline-note")).toHaveCount(0);

  await rows.first().click();
  // The row highlights (aria-pressed=true) and exactly one note opens.
  await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
  const note = page.getByTestId("write-inline-note");
  await expect(note).toHaveCount(1);
  await expect(note).toBeVisible();

  // Only ONE mark open at a time: clicking a second row moves the note.
  if ((await rows.count()) > 1) {
    await rows.nth(1).click();
    await expect(rows.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(rows.first()).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("write-inline-note")).toHaveCount(1);
  }
});

test("write: the inline note offers three differentiated actions (§7 Phase 7)", async ({
  page,
}) => {
  await page.goto("/write");
  await page.locator("button[aria-pressed]").first().click();
  const note = page.getByTestId("write-inline-note");
  await expect(note).toBeVisible();
  // Three distinct action buttons inside the note (wiki / text / leave).
  const actions = note.locator("button");
  expect(await actions.count()).toBeGreaterThanOrEqual(3);
});

test("focus ring is the accent colour (2px/3px solid) — keyboard focus visible", async ({
  page,
}) => {
  await page.goto("/wiki");
  // Tab to the first focusable and read its computed outline.
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const s = getComputedStyle(el);
    return { color: s.outlineColor, style: s.outlineStyle, width: s.outlineWidth };
  });
  expect(outline).not.toBeNull();
  // Accent is #ec3013 -> rgb(236, 48, 19).
  expect(outline!.color).toContain("236, 48, 19");
  expect(outline!.style).toBe("solid");
});

test("research: 'Yes, write it in' flips the kept item to 'In the wiki'", async ({
  page,
}) => {
  await page.goto("/research");
  // Keep a card, make it an entry, confirm.
  await page.getByRole("button", { name: "Keep", exact: true }).first().click();
  await page
    .getByRole("button", { name: "Make it an entry", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Yes, write it in", exact: false }).click();
  // The kept board item now shows the "In the wiki" state.
  await expect(page.getByText("In the wiki", { exact: false }).first()).toBeVisible();
});
