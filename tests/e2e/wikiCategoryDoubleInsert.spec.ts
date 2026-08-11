import { test, expect, type Page } from "@playwright/test";

// TCK-010 — "+ New category" double-insert regression (1 click used to write 2
// rows). Runs against the SHARED seeded DB alongside the rest of the suite, so
// it is strictly ISOLATED: it creates a uniquely-named category, asserts exactly
// one group carries that label, and deletes every group with that label at the
// end. It NEVER touches a built-in category or a seed entry.
//
// ROOT CAUSE: the create handler double-fires the WHOLE commit (not just the
// startTransition body). The pre-fix client minted a fresh UUID on every commit,
// so a doubled commit wrote TWO distinct rows. The FIX mints the category id
// ONCE per form-open (NewCategoryShelf idRef) and reuses it across a doubled
// commit; the server INSERT ... ON CONFLICT (id) DO NOTHING then collapses the
// double-fire to exactly one row.

function grid(page: Page) {
  // The shelves grid lives in <main>, distinct from the left index nav.
  return page.locator("main");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/wiki");
  await expect(page.getByText("Maren", { exact: false }).first()).toBeVisible();
  // Focus a seed entry so the shelves grid (only rendered when an entry is
  // selected) is mounted.
  await page.getByRole("heading").first().waitFor();
});

test("wiki category double-insert: a DOUBLE-fired create commit still yields exactly ONE row (TCK-010)", async ({
  page,
}) => {
  // TCK-010 acceptance: "double-fire of the handler still yields 1 row". A single
  // Playwright click only fires the handler once, so it cannot exercise the
  // regression. We FORCE the double-fire the way React-18 does: dispatch two
  // native submit events on the open form synchronously, before it collapses, so
  // both commits run against the same idRef.current. Under the fix that is one
  // row; under the pre-fix per-commit-id code it is two (RED).
  const unique = `Relics ${Date.now()}`;
  await page.getByRole("button", { name: "+ New category" }).click();
  const newShelf = page.locator('section[aria-label="New category"]');
  await expect(newShelf).toBeVisible();
  await newShelf.getByRole("textbox", { name: "New category name" }).fill(unique);
  await newShelf
    .getByRole("combobox", { name: "New category shelf" })
    .selectOption("lore");

  // Fire the form submit TWICE synchronously (one user gesture, two handler
  // invocations) — the React-18 double-invoke this ticket is about.
  await newShelf.locator("form").evaluate((form: HTMLFormElement) => {
    const ev = () =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    ev();
    ev();
  });

  // Exactly one group section carries the label — two would mean two rows.
  const group = grid(page).locator(`section[aria-label="${unique}"]`);
  await expect(group.first()).toBeVisible();
  await expect(group).toHaveCount(1);

  // Clean up: delete every group carrying this label (defensive loop leaves no
  // shared-DB residue even if a regression created two).
  let guard = 0;
  while ((await grid(page).locator(`section[aria-label="${unique}"]`).count()) > 0) {
    if (guard++ > 4) break;
    const section = grid(page).locator(`section[aria-label="${unique}"]`).first();
    await section
      .getByRole("button", { name: `Delete ${unique} category` })
      .click();
    await page.getByRole("button", { name: "Delete category", exact: true }).click();
    await expect(section).toHaveCount(0);
  }
  await expect(
    grid(page).locator(`section[aria-label="${unique}"]`),
  ).toHaveCount(0);
});
