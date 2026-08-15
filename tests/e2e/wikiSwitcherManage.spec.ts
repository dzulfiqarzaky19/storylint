import { test, expect, type Page } from "@playwright/test";
import { countRows, queryOne } from "./_helpers/db";

// 3a WorldSwitcher (breadcrumb dropdown) + 3c manage screen (/wiki/manage).
//
// The old toolbar band (Universe/World <select> + create/delete buttons) was
// replaced by:
//   - a "Universe / World ▾" breadcrumb button on /wiki that opens ONE grouped
//     dropdown: each universe is a header, its worlds are menuitemradio rows
//     (active one ticked). Clicking a world navigates to ?u=&w= for that scope.
//   - a shared /wiki/manage screen for create / rename / delete of universes and
//     worlds, with a type-the-name delete confirm and a last-world-per-universe
//     guard.
//
// This spec drives the REAL new affordances at :3100 and proves, on BOTH the UI
// and the DATABASE, that: (create) a new world lands as a real row; (switch) the
// dropdown navigates scope and the breadcrumb + URL update; (rename) the world
// row's title changes in the DB; (delete) the type-the-name gate blocks until the
// exact name is typed, then removes the row. Self-cleaning: it creates a uniquely
// named world, exercises it, and deletes it, leaving shared state as found. It
// never TRUNCATEs, so it is safe alongside other specs / agents.

function crumb(page: Page) {
  return page.getByRole("button", { name: /Switch universe or world|▾/ }).first();
}

function switcherButton(page: Page) {
  // The breadcrumb button carries aria-haspopup="menu".
  return page.locator('button[aria-haspopup="menu"]');
}

test("3a switcher + 3c manage: create, switch, rename, type-the-name delete", async ({
  page,
}) => {
  const unique = `Nowhere ${Date.now()}`;
  const renamed = `${unique} Reach`;

  // ---- Baseline: /wiki renders the breadcrumb (Universe / World ▾). ----------
  await page.goto("/wiki");
  const bar = switcherButton(page);
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("ASHKELD WORLD");

  const before = await countRows("worlds", "universe_id = $1", ["universe-1"]);
  expect(before).toBeGreaterThanOrEqual(1);

  // ---- 3c CREATE: make a new world on the manage screen. --------------------
  await page.goto("/wiki/manage");
  await expect(
    page.getByRole("heading", { name: "Manage universes & worlds" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ New world" }).click();
  const createDialog = page.getByRole("dialog", { name: "Name the new world" });
  await createDialog.getByRole("textbox").fill(unique);
  await createDialog.getByRole("button", { name: "Create" }).click();

  // DB read-back: the world row exists under the active universe.
  await expect
    .poll(async () => countRows("worlds", "universe_id = $1", ["universe-1"]))
    .toBe(before + 1);
  const created = await queryOne<{ id: string; title: string }>(
    `SELECT id, title FROM worlds WHERE universe_id = $1 AND title = $2`,
    ["universe-1", unique],
  );
  expect(created?.title).toBe(unique);
  const worldId = created!.id;

  // ---- 3a SWITCH: the new world appears in the grouped dropdown; picking it
  // navigates scope and updates the breadcrumb + URL. ------------------------
  await page.goto("/wiki");
  await switcherButton(page).click();
  const menu = page.getByRole("menu", { name: "Switch universe or world" });
  await expect(menu).toBeVisible();
  // Grouped under the "FANTASY UNIVERSE" universe header, both worlds are radios.
  const newRadio = menu.getByRole("menuitemradio", { name: unique });
  await expect(newRadio).toBeVisible();
  await newRadio.click();

  // URL now carries the new world's ?w= and the breadcrumb reads it.
  await expect(page).toHaveURL(new RegExp(`w=${worldId}`));
  await expect(switcherButton(page)).toContainText(unique);

  // BUG-GUARD (TCK-E02, no snap-back): the new world's gazetteer is EMPTY — the
  // index header reads "0 entries", proving the switch landed on the new world
  // and not on the populated ASHKELD WORLD wiki. DB read-back: zero membership links.
  await expect(
    page.locator('nav[aria-label="The world"]').getByText(/\b0 entries\b/),
  ).toBeVisible();
  expect(await countRows("world_entities", "world_id = $1", [worldId])).toBe(0);

  // ---- 3c RENAME: change the world's title; DB reflects it. -----------------
  await page.goto("/wiki/manage");
  const worldRow = page
    .locator('li[class*="__world"]')
    .filter({ hasText: unique })
    .first();
  await worldRow.getByRole("button", { name: "Rename" }).click();
  const renameDialog = page.getByRole("dialog", { name: /Rename/ });
  const renameBox = renameDialog.getByRole("textbox");
  await renameBox.fill(renamed);
  await renameDialog.getByRole("button", { name: "Rename" }).click();

  await expect
    .poll(async () => {
      const r = await queryOne<{ title: string }>(
        `SELECT title FROM worlds WHERE id = $1`,
        [worldId],
      );
      return r?.title ?? null;
    })
    .toBe(renamed);

  // ---- 3c DELETE (type-the-name gate): confirm stays disabled until the exact
  // world name is typed, then the row is removed. ----------------------------
  const renamedRow = page
    .locator('li[class*="__world"]')
    .filter({ hasText: renamed })
    .first();
  await renamedRow.getByRole("button", { name: "Delete" }).click();

  const delDialog = page.getByRole("dialog");
  await expect(delDialog).toBeVisible();
  const confirmBtn = delDialog.getByRole("button", { name: /Delete/ });
  const typeBox = delDialog.getByRole("textbox");

  // Gate closed before typing.
  await expect(confirmBtn).toBeDisabled();
  // Wrong name (a prefix) keeps it closed.
  await typeBox.fill(unique);
  await expect(confirmBtn).toBeDisabled();
  // Exact name arms it.
  await typeBox.fill(renamed);
  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();

  // DB read-back: the world row is gone; universe is back to its original count.
  await expect
    .poll(async () => countRows("worlds", "id = $1", [worldId]))
    .toBe(0);
  await expect
    .poll(async () => countRows("worlds", "universe_id = $1", ["universe-1"]))
    .toBe(before);
});

test("3c manage: the last world in a universe cannot be deleted", async ({
  page,
}) => {
  await page.goto("/wiki/manage");
  // With the seed universe holding exactly one world, its Delete is disabled and
  // explains why via title text.
  const count = await countRows("worlds", "universe_id = $1", ["universe-1"]);
  test.skip(count !== 1, "guard only asserts when the universe has one world");

  const soleWorldDelete = page
    .locator('li[class*="__world"]')
    .filter({ has: page.getByRole("button", { name: "Delete" }) })
    .first()
    .getByRole("button", { name: "Delete" });
  await expect(soleWorldDelete).toBeDisabled();
});
