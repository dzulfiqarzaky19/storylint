import { test, expect, type Page, type Locator } from "@playwright/test";
import { reseed } from "../_helpers/seed";

// T-RESEARCH-LOCK-3 (R3): lock the ALREADY-BUILT last-thread delete guard on
// /research. No app change — a pure DETERMINISTIC (no-AI) e2e lock. It proves the
// ResearchIndex rule (the trash icon renders only when threads.length > 1): a
// world holding exactly ONE thread offers NO delete affordance; adding a second
// brings the trash back; deleting down to one hides it again — the last thread of
// a world can never be removed through the UI.
//
// Base world: VOSK REACH (world-vosk) seeds EXACTLY ONE thread, so it starts at
// the guarded floor. The arc adds a thread ("+ New thread") then deletes it, so
// the whole present -> absent transition is exercised in one world. addThread /
// deleteThread are AI-free, so this is fully deterministic.
//
// This spec MUTATES (adds then deletes a thread), so it reseeds in its OWN
// afterAll to leave the shared DB pristine for later-sorting specs.

const VOSK = "world-vosk";

/** The research thread rail, expanded (its toggle open) so the rows are live. */
async function openRail(page: Page): Promise<Locator> {
  const nav = page.locator('nav[aria-label="Research threads"]');
  const toggle = nav.locator("button[aria-expanded]").first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  return nav;
}

/** Thread SELECT buttons (one per thread) — the first button in each panel row. */
function threadRows(nav: Locator): Locator {
  return nav.locator("ul > li > div > button:first-child");
}

/** Per-row TRASH buttons (aria-label 'Delete thread "…"'); the guarded affordance.
 *  All seeded/added threads are titled "New thread", so this counts by affordance,
 *  never by a unique title. */
function trashButtons(nav: Locator): Locator {
  return nav.locator('button[aria-label^="Delete thread"]');
}

test.afterAll(reseed);

test("R3: the last thread of a world cannot be deleted (UI guard hides the trash)", async ({
  page,
}) => {
  await page.goto(`/research?w=${VOSK}`);
  let nav = await openRail(page);

  // FLOOR: Vosk seeds exactly one thread, so the guard hides the trash entirely.
  await expect(threadRows(nav)).toHaveCount(1);
  await expect(trashButtons(nav)).toHaveCount(0);

  // ADD a second thread ("+ New thread"): this soft-navigates to ?thread=<new>,
  // so re-open the rail before counting. The trash returns on both rows.
  await nav.getByRole("button", { name: "+ New thread" }).click();
  nav = await openRail(page);
  await expect(threadRows(nav)).toHaveCount(2);
  await expect(trashButtons(nav)).toHaveCount(2);

  // DELETE one (trash -> confirm modal 'Delete "New thread"?' -> Delete).
  await trashButtons(nav).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();

  // BACK AT THE FLOOR: one thread remains and the trash is gone again.
  nav = await openRail(page);
  await expect(threadRows(nav)).toHaveCount(1);
  await expect(trashButtons(nav)).toHaveCount(0);
});
