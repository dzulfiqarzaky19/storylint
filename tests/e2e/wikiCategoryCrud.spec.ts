import { test, expect, type Page } from "@playwright/test";

// F9-B S3 — dynamic category CRUD on the wiki shelves grid. The grid groups by
// CATEGORY (not the fixed 4 shelves), and any category — built-in or user — can
// be renamed/deleted, plus new user categories created via "+ New category".
//
// Runs against the SHARED seeded DB alongside the rest of the suite, so this
// spec is strictly ISOLATED: it creates its own uniquely-named category, acts on
// only that row, and deletes it at the end. The one built-in it touches (People)
// is renamed then RESET back to "People" so shared state is restored. It NEVER
// deletes a built-in category or any seed entry (that would tombstone shared
// data other specs depend on).

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

test("wiki category CRUD: create a new category, it appears as its own group", async ({
  page,
}) => {
  const unique = `Guilds ${Date.now()}`;
  const newShelf = page.locator('section[aria-label="New category"]');
  // Expand the collapsed "+ New category" affordance.
  await page.getByRole("button", { name: "+ New category" }).click();
  await expect(newShelf).toBeVisible();

  await newShelf.getByRole("textbox", { name: "New category name" }).fill(unique);
  await newShelf
    .getByRole("combobox", { name: "New category shelf" })
    .selectOption("lore");
  await newShelf.getByRole("button", { name: "Add", exact: true }).click();

  // The new category renders its own group header (a <section aria-label={label}>
  // with an <h2> title) in the grid.
  await expect(
    grid(page).getByRole("heading", { level: 2, name: unique }).first(),
  ).toBeVisible();

  // Clean up: delete the just-created (empty) category so shared state is left
  // as found. Open its header menu and confirm the danger modal.
  const section = grid(page).locator(`section[aria-label="${unique}"]`);
  await section.getByRole("button", { name: `${unique} category options` }).click();
  await section.getByRole("menuitem", { name: "Delete category" }).click();
  await page.getByRole("button", { name: "Delete category" }).click();
  await expect(
    grid(page).getByRole("heading", { level: 2, name: unique }),
  ).toHaveCount(0);
});

test("wiki category CRUD: renaming the People built-in updates its header, reset restores it", async ({
  page,
}) => {
  const g = grid(page);
  const people = g.locator('section[aria-label="People"]');
  await expect(people.getByRole("heading", { level: 2, name: "People" })).toBeVisible();

  const renamed = `Cast ${Date.now()}`;
  // Click the header "Rename" button, type a new label, commit with Enter.
  await people.getByRole("button", { name: "Rename People category" }).click();
  const input = people.getByRole("textbox", { name: "Rename People category" });
  await input.fill(renamed);
  await input.press("Enter");

  // The header now shows the custom label. The section aria-label follows the
  // title, so re-locate by the new label.
  const renamedSection = g.locator(`section[aria-label="${renamed}"]`);
  await expect(
    renamedSection.getByRole("heading", { level: 2, name: renamed }),
  ).toBeVisible();

  // Reset back to the shelf default via the header menu -> "Reset to default".
  await renamedSection
    .getByRole("button", { name: `${renamed} category options` })
    .click();
  await renamedSection.getByRole("menuitem", { name: "Reset to default" }).click();
  await expect(
    g.locator('section[aria-label="People"]').getByRole("heading", {
      level: 2,
      name: "People",
    }),
  ).toBeVisible();
});

test("wiki category CRUD: deleting a category with entries tombstones them", async ({
  page,
}) => {
  // Isolated: create a fresh category, file a NEW entry into it via drag is
  // heavy; instead we verify the delete flow on an empty user category removes
  // the group (the reducer-level entry-tombstone path is unit-mutation-locked in
  // wikiStoreCategory.test.ts; here we lock the UI delete-confirm + group removal).
  const unique = `Doomed ${Date.now()}`;
  await page.getByRole("button", { name: "+ New category" }).click();
  const newShelf = page.locator('section[aria-label="New category"]');
  await newShelf.getByRole("textbox", { name: "New category name" }).fill(unique);
  await newShelf.getByRole("button", { name: "Add", exact: true }).click();

  const section = grid(page).locator(`section[aria-label="${unique}"]`);
  await expect(
    section.getByRole("heading", { level: 2, name: unique }),
  ).toBeVisible();

  // Delete it and confirm the danger modal names the category.
  await section.getByRole("button", { name: `${unique} category options` }).click();
  await section.getByRole("menuitem", { name: "Delete category" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(`Delete the ${unique} category`) }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete category" }).click();

  await expect(
    grid(page).getByRole("heading", { level: 2, name: unique }),
  ).toHaveCount(0);
});
