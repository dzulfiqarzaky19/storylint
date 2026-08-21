import { test, expect, type Page } from "@playwright/test";
import { countRows, queryOne } from "../_helpers/db";

// T-RESEARCH-LOCK-2 (R2): lock the R2 BUILD — every new world is born with
// EXACTLY ONE default research thread. The build adds one research_threads INSERT
// inside BOTH world-minting transactions (createFreshUniverse + insertWorld), so
// /research never renders an empty rail and R3's last-thread-delete guard always
// has a floor of one.
//
// This spec drives the REAL insertWorld path (the /wiki/manage "+ New world"
// recipe) at :3100 and proves the invariant on BOTH surfaces:
//   - DATABASE: the new world's research_threads count is EXACTLY 1 (the seed).
//   - UI: switching to the new world, the /research thread rail shows EXACTLY 1
//     thread titled "New thread".
//
// Self-cleaning: it mints a uniquely named world, asserts, then DELETES it via the
// manage type-the-name gate. research_threads.world_id FKs worlds(id) ON DELETE
// CASCADE, so deleting the world removes its seeded thread too — shared state is
// left as found. It never TRUNCATEs, so it is safe alongside other specs / agents.

const SEED_UNIVERSE = "universe-1";
const SEED_UNIVERSE_NAME = "FANTASY UNIVERSE";

function switcherButton(page: Page) {
  return page.locator('button[aria-haspopup="menu"]');
}

/** The manage-screen <li> for one universe (scopes its "+ New world" — the seed
 *  now holds TWO universes, so an unscoped "+ New world" matches two buttons). */
function universeRow(page: Page, name: string) {
  return page
    .locator('li[class*="__universe"]')
    .filter({ has: page.getByRole("heading", { name }) });
}

/** The /research thread rail; count = the thread SELECT buttons (one per thread). */
async function threadRows(page: Page) {
  const nav = page.locator('nav[aria-label="Research threads"]');
  const toggle = nav.locator("button[aria-expanded]").first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  // Each thread row renders a SELECT button (plus a per-row TRASH button when the
  // world has >1 thread); count the first button in each panel <li> so the trash
  // affordance and the "+ New thread" row never inflate the count.
  return nav.locator("ul > li > div > button:first-child");
}

test("R2: a newly created world is born with exactly one default research thread", async ({
  page,
}) => {
  const unique = `Threadborn ${Date.now()}`;
  const before = await countRows("worlds", "universe_id = $1", [SEED_UNIVERSE]);

  // ---- CREATE a new world through the real insertWorld path (/wiki/manage). ---
  await page.goto("/wiki/manage");
  await universeRow(page, SEED_UNIVERSE_NAME)
    .getByRole("button", { name: "+ New world" })
    .click();
  const createDialog = page.getByRole("dialog", { name: "Name the new world" });
  await createDialog.getByRole("textbox").fill(unique);
  await createDialog.getByRole("button", { name: "Create" }).click();

  await expect
    .poll(async () => countRows("worlds", "universe_id = $1", [SEED_UNIVERSE]))
    .toBe(before + 1);
  const created = await queryOne<{ id: string }>(
    `SELECT id FROM worlds WHERE universe_id = $1 AND title = $2`,
    [SEED_UNIVERSE, unique],
  );
  const worldId = created!.id;

  // ---- DB invariant: EXACTLY ONE seeded thread for the new world. ------------
  // This is the R2 proof point: the mutation-proof loop kills the seed INSERT and
  // this count drops to 0, turning the assertion RED for its own reason.
  expect(await countRows("research_threads", "world_id = $1", [worldId])).toBe(1);
  const thread = await queryOne<{ title: string; scope: string }>(
    `SELECT title, scope FROM research_threads WHERE world_id = $1`,
    [worldId],
  );
  expect(thread?.title).toBe("New thread");
  expect(thread?.scope).toBe("chat");

  // ---- UI: switch to the new world; its /research rail shows EXACTLY 1 thread. -
  await page.goto("/wiki");
  await switcherButton(page).click();
  const menu = page.getByRole("menu", { name: "Switch universe or world" });
  await menu.getByRole("menuitemradio", { name: unique }).click();
  await expect(page).toHaveURL(new RegExp(`w=${worldId}`));

  await page.goto(`/research?w=${worldId}`);
  await expect(await threadRows(page)).toHaveCount(1);

  // ---- SELF-CLEAN: delete the world (FK cascade removes its seeded thread). ----
  await page.goto("/wiki/manage");
  const worldRow = page
    .locator('li[class*="__world"]')
    .filter({ hasText: unique })
    .first();
  await worldRow.getByRole("button", { name: "Delete" }).click();
  const delDialog = page.getByRole("dialog");
  await delDialog.getByRole("textbox").fill(unique);
  await delDialog.getByRole("button", { name: /Delete/ }).click();

  await expect.poll(async () => countRows("worlds", "id = $1", [worldId])).toBe(0);
  // FK ON DELETE CASCADE: the seeded thread is gone with its world.
  expect(await countRows("research_threads", "world_id = $1", [worldId])).toBe(0);
});
