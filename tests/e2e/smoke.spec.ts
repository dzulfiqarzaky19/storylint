import { test, expect } from "@playwright/test";
import { railRows } from "./_helpers/rail";
import { withDb } from "./_helpers/db";

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

test("wiki: left index groups the world and click focuses an entry", async ({
  page,
}) => {
  await page.goto("/wiki");
  const index = page.locator('nav[aria-label="The world"]');
  await expect(index).toBeVisible();
  // Four collapsible groups, each an aria-expanded button.
  for (const group of ["PEOPLE", "PLACES", "ORDERS", "LORE"]) {
    await expect(
      index.locator("button[aria-expanded]").filter({ hasText: group }),
    ).toBeVisible();
  }
  // Clicking an index entry focuses it: the big entry heading changes.
  await index.getByRole("button", { name: /Teodor Kest/ }).click();
  await expect(page.getByRole("heading", { name: /Teodor Kest/i })).toBeVisible();
  // Collapsing a group hides its items.
  const people = index.locator("button[aria-expanded]").filter({ hasText: "PEOPLE" });
  await people.click();
  await expect(people).toHaveAttribute("aria-expanded", "false");
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

  // At 1440 the rail sits to the RIGHT of the manuscript (higher x, similar y
  // band) and is always open — no toggle, promise visible.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.getByRole("button", { name: /two signals/i }),
  ).toBeHidden();
  await expect(rail).toBeVisible();
  const wideRail = await rail.boundingBox();
  const wideMs = await manuscript.boundingBox();
  expect(wideRail && wideMs && wideRail.x).toBeGreaterThan(wideMs!.x);

  // At 1100 the rail becomes a collapsible panel BELOW the manuscript. It
  // starts collapsed (body hidden); the toggle opens it.
  await page.setViewportSize({ width: 1100, height: 900 });
  const toggle = page.getByRole("button", { name: /two signals/i });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(rail).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(rail).toBeVisible();
  // Opened, the rail body sits BELOW the manuscript (greater y) — stacked.
  const narrowRail = await rail.boundingBox();
  const narrowMs = await manuscript.boundingBox();
  expect(narrowRail && narrowMs && narrowRail.y).toBeGreaterThan(narrowMs!.y);
  // Toggle closes it again.
  await toggle.click();
  await expect(rail).toBeHidden();
});

test("write: clicking a rail row opens the inline note and highlights the row (§7)", async ({
  page,
}) => {
  await page.goto("/write");
  const rows = railRows(page);
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
  await railRows(page).first().click();
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

  // Regression (data-integrity): a card written into the wiki is permanently
  // kept. Its "Kept" toggle must be DISABLED so it cannot be un-kept — an
  // un-keep would delete the kept_cards row that records the wiki write and
  // desync the board from the persisted entry on reload.
  const keptToggle = page.getByRole("button", { name: "Kept", exact: true }).first();
  await expect(keptToggle).toBeVisible();
  await expect(keptToggle).toBeDisabled();
});

// ---------------------------------------------------------------------------
// Mobile tier (390x844, Pixel-ish). Reflow must not overflow horizontally and
// the primary nav must stay reachable. Desktop layout is untouched.
// ---------------------------------------------------------------------------
for (const path of ["/wiki", "/research", "/write"]) {
  test(`mobile @390: ${path} has no horizontal overflow and keeps nav visible`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    // globals.css sets html,body{overflow-x:hidden}, which clamps
    // documentElement.scrollWidth to clientWidth — so measuring the document
    // would mask a genuinely overflowing child. Instead measure the widest
    // rendered element's right edge against the viewport (defeats the clamp).
    const maxRight = await page.evaluate(() => {
      let m = 0;
      document.querySelectorAll("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > m) m = r.right;
      });
      return Math.ceil(m);
    });
    expect(maxRight).toBeLessThanOrEqual(390 + 1);
    // The current screen's nav link stays reachable (Header lives in layout).
    await expect(page.getByRole("link", { name: /wiki/i }).first()).toBeVisible();
    // Readability floor: body copy must not shrink below 16px on phones.
    const bodyFont = await page.evaluate(() => {
      const el = document.querySelector("p");
      return el ? parseFloat(getComputedStyle(el).fontSize) : 999;
    });
    expect(bodyFont).toBeGreaterThanOrEqual(16);
  });
}

// Regression: on mobile the "Two signals" open/close toggle must be visible
// without scrolling. The Header is a sticky 74px bar in normal flow, so a
// 100vh .screen used to overflow the viewport and push the collapsed toggle
// below the fold (y+height was 918 > 844) — the control looked missing. The
// rail is now sticky to the viewport bottom; assert the collapsed toggle sits
// fully within the 844px viewport.
// This ONE test depends on a seeded mark ("nineteen and sworn", a Ch7 conflict
// that write-conflict.spec also uses). Under the default run it is fine
// (globalSetup fresh-seeds and smoke sorts before write-conflict), but under
// E2E_SKIP_SEED=1 on a DB left dirty by a prior session a stale resolved_marks
// row can suppress that mark. Give just this mark-dependent test a clean board
// via a scoped beforeAll that clears resolved_marks, so smoke stays read-only
// everywhere else (no file-wide beforeEach) while this test is self-sufficient.
test.describe("mobile signals (mark-dependent, clears suppression)", () => {
  // Clear ONLY the runtime suppression table so a stale resolved_marks row
  // (e.g. from an aborted session under E2E_SKIP_SEED) cannot hide the
  // "nineteen and sworn" conflict. A full reseed would also TRUNCATE
  // kept_cards, robbing later same-file tests that rely on kept state, so we
  // touch nothing but resolved_marks. No smoke test asserts a mark IS
  // suppressed, so clearing this table is safe here.
  test.beforeAll(async () => {
    await withDb((c) => c.query("DELETE FROM resolved_marks"));
  });

  test("write @390: the 'Two signals' toggle is visible without scrolling", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/write");
    const toggle = page.getByRole("button", { name: /two signals/i });
    await expect(toggle).toBeVisible();
    const box = await toggle.boundingBox();
    expect(box).not.toBeNull();
    // Bottom edge within the viewport (allow a 1px sub-pixel rounding margin).
    expect(box!.y + box!.height).toBeLessThanOrEqual(844 + 1);
    // And the body is collapsed by default (a suggestion row is not yet shown).
    await expect(page.getByRole("button", { name: /nineteen and sworn/i })).toHaveCount(0);
    // Opening it reveals the signals; the toggle stays on screen.
    await toggle.click();
    await expect(page.getByRole("button", { name: /nineteen and sworn/i })).toBeVisible();
    const box2 = await toggle.boundingBox();
    expect(box2!.y + box2!.height).toBeLessThanOrEqual(844 + 1);
  });
});

// Cross-screen uniformity: the Research KEPT board and the Wiki poster band use
// the SAME collapsible sticky-bottom toggle as the Write rail on phones. Each
// assertion pins the collapsed toggle to the viewport fold and proves the body
// gates on aria-expanded. The plain accessible name "Kept" also matches the
// per-card "Kept" buttons, so we select the toggle by its aria-controls hook.
test("research @390: the KEPT toggle is visible without scrolling and gates the board", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/research");
  const toggle = page
    .locator("button[aria-controls]")
    .filter({ hasText: /kept/i })
    .first();
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  const box = await toggle.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844 + 1);
  // Collapsed: the empty-state / kept rows are not shown.
  await expect(page.getByText(/nothing kept yet/i)).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const box2 = await toggle.boundingBox();
  expect(box2!.y + box2!.height).toBeLessThanOrEqual(844 + 1);
});

test("wiki @390: the suggestions poster toggle is visible without scrolling and gates the cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/wiki");
  const toggle = page
    .locator("button[aria-controls]")
    .filter({ hasText: /mention|thing/i })
    .first();
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  // Scroll to the end of the document; the sticky bar stays pinned to the fold.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const box = await toggle.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844 + 1);
  // Collapsed: the "Write it in" actions are not shown.
  await expect(page.getByRole("button", { name: /write it in/i })).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: /write it in/i }).first(),
  ).toBeVisible();
  const box2 = await toggle.boundingBox();
  expect(box2!.y + box2!.height).toBeLessThanOrEqual(844 + 1);
});

// ---- Left navigation + in-place authoring (uniform across all 3 screens) ----

test("research: left thread index switches threads (URL-driven, own question)", async ({
  page,
}) => {
  await page.goto("/research");
  const index = page.locator('nav[aria-label="Research threads"]');
  await expect(index).toBeVisible();
  await expect(index.getByRole("button", { name: /Salt as debt/ })).toBeVisible();
  const ferrier = index.getByRole("button", { name: /Naming the Ferrier/ });
  await expect(ferrier).toBeVisible();
  await expect(page.getByText(/salt-name is a debt/i)).toBeVisible();
  await ferrier.click();
  await expect(page).toHaveURL(/thread=the-ferrier/);
  await expect(page.getByText(/salt-name is a debt/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Naming the Ferrier/i })).toBeVisible();
});

test("write: left chapter index lists all chapters and switches the manuscript", async ({
  page,
}) => {
  await page.goto("/write");
  const index = page.locator('nav[aria-label="Chapters"]');
  await expect(index).toBeVisible();
  await expect(index.getByRole("button", { name: /Low Water/ })).toBeVisible();
  const three = index.getByRole("button", { name: /The Ledger/ });
  await expect(three).toBeVisible();
  await three.click();
  await expect(page).toHaveURL(/chapter=3/);
  await expect(page.getByRole("heading", { name: /The Ledger/i })).toBeVisible();
});

test("wiki: an inline detail edit persists across reload (manual authoring)", async ({
  page,
}) => {
  await page.goto("/wiki");
  const value = page
    .locator("li[class*='DetailsColumn-module'] span[class*='value'] button")
    .first();
  await expect(value).toBeVisible();
  await value.click();
  const editor = page.locator("input[class*='InlineText-module']");
  await expect(editor).toBeVisible();
  await editor.fill("Twenty-two");
  await editor.press("Enter");
  await page.reload();
  await expect(
    page
      .locator("li[class*='DetailsColumn-module'] span[class*='value'] button")
      .filter({ hasText: "Twenty-two" }),
  ).toBeVisible();
});

// Uniform left-index collapse on the stacked tier (<=1200px). Regression guard
// for the tablet bug where the tall wiki index bled down OVER the entry body:
// each screen's left index must fold behind a header toggle (closed by default)
// and, once opened, must not overlap the content beside it.
type Box = { x: number; y: number; width: number; height: number };
function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

const INDEX_CASES = [
  { path: "/wiki", nav: 'nav[aria-label="The world"]', body: "main", item: /Maren Vell/ },
  { path: "/research", nav: 'nav[aria-label="Research threads"]', body: "main", item: /Salt as debt/ },
  {
    path: "/write",
    nav: 'nav[aria-label="Chapters"]',
    body: '[class*="manuscriptScroll"]',
    item: /Low Water/,
  },
];

for (const c of INDEX_CASES) {
  test(`${c.path} @tablet: left index folds behind a toggle and never overlaps the body`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.goto(c.path);
    const nav = page.locator(c.nav);
    const toggle = nav.locator("button[aria-controls]").first();
    const item = nav.getByRole("button", { name: c.item });

    // Closed by default: toggle present, index item hidden.
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(item).toBeHidden();

    // Open: item appears and the panel does not overlap the body column.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(item).toBeVisible();
    const navBox = (await nav.boundingBox())!;
    const bodyBox = (await page.locator(c.body).first().boundingBox())!;
    expect(boxesOverlap(navBox, bodyBox), `${c.path} index overlaps body`).toBe(false);

    // Close again.
    await toggle.click();
    await expect(item).toBeHidden();
  });

  test(`${c.path} @desktop: the left index is always shown (toggle inert)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(c.path);
    await expect(
      page.locator(c.nav).getByRole("button", { name: c.item }),
    ).toBeVisible();
  });
}
