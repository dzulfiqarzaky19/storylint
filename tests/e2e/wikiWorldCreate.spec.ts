import { test, expect, type Page } from "@playwright/test";
import { countRows, queryOne } from "./_helpers/db";

// TCK-E02 — creating a 2nd world under a universe must SELECT that new world (its
// EMPTY gazetteer), not "snap back" to the universe's first world. The bug:
// WorldSwitcher.onNewWorld only called router.refresh() and never navigated to
// the new world's ?w=, so resolveWikiScope fell back to worlds[0] and the
// gazetteer showed the OLD world's entries.
//
// This spec drives the real "+ world" flow at :3100 and proves, on BOTH the UI
// (the World select flips to the new world; the index header reads "0 entries")
// and the DATABASE (world_entities has zero links for the new world id), that the
// writer lands on the new empty world. Isolated + self-cleaning: it creates a
// uniquely-named world, asserts against ONLY that world's id, then DELETES it so
// the shared DB is left exactly as found. It never TRUNCATEs shared state
// (no reseed), so it is safe to run alongside other specs / agents.

function worldSelect(page: Page) {
  return page.getByRole("combobox", { name: "Active world" });
}

function index(page: Page) {
  return page.locator('nav[aria-label="The world"]');
}

test("wiki world create: a new world is selected and its gazetteer is empty (no snap-back)", async ({
  page,
}) => {
  await page.goto("/wiki");
  await expect(page.getByText("Maren", { exact: false }).first()).toBeVisible();

  // The seeded universe starts with one world (Ashkeld) full of seed entries.
  const before = await countRows("worlds", "universe_id = $1", ["universe-1"]);
  expect(before).toBeGreaterThanOrEqual(1);

  const unique = `Nowhere ${Date.now()}`;

  // Drive the real "+ world" affordance -> NamePrompt -> Create.
  await page.getByRole("button", { name: "+ world" }).click();
  const dialog = page.getByRole("dialog", { name: "Name the new world" });
  await dialog.getByRole("textbox").fill(unique);
  await dialog.getByRole("button", { name: "Create" }).click();

  // BUG-GUARD (UI): after create the World select must show the NEW world as its
  // selected value, not snap back to Ashkeld. Wait for the option to exist, then
  // assert it is the selected one.
  const select = worldSelect(page);
  await expect(select.locator("option", { hasText: unique })).toHaveCount(1);
  // The currently-selected option's label IS the new world (not "Ashkeld").
  const selectedLabel = await select.evaluate(
    (el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent ?? "",
  );
  expect(selectedLabel).toBe(unique);

  // Resolve the new world's real id from the option value for the DB read-back.
  const newWorldId = await select
    .locator("option", { hasText: unique })
    .getAttribute("value");
  expect(newWorldId).toBeTruthy();

  // BUG-GUARD (UI): the gazetteer is EMPTY — the index header reads "0 entries",
  // proving we are NOT looking at Ashkeld's populated wiki.
  await expect(index(page).getByText(/\b0 entries\b/)).toBeVisible();

  // BUG-GUARD (DB): the new world has ZERO membership links. If the page had
  // snapped back to Ashkeld this test would still pass on the DB alone, so the UI
  // assertions above are what catch the snap-back; this pins the "new world is
  // genuinely empty" invariant the feature promises.
  const links = await countRows("world_entities", "world_id = $1", [newWorldId]);
  expect(links).toBe(0);

  // The world row itself exists and belongs to the active universe (sanity).
  const row = await queryOne<{ universe_id: string }>(
    `SELECT universe_id FROM worlds WHERE id = $1`,
    [newWorldId],
  );
  expect(row?.universe_id).toBe("universe-1");

  // ---- Clean up: delete the just-created (empty) world so shared state is left
  // as found. The delete-world affordance is enabled now that the universe has
  // >1 world; confirm the danger modal.
  await page.getByRole("button", { name: "delete world" }).click();
  await page.getByRole("button", { name: /Delete \d+ rows/ }).click();
  // Back to a single world for the universe.
  await expect
    .poll(async () => countRows("worlds", "universe_id = $1", ["universe-1"]))
    .toBe(before);
});
