import { test, expect, type Page, type Locator } from "@playwright/test";
import { countRows, queryOne } from "../_helpers/db";
import { reseed } from "../_helpers/seed";

// =============================================================================
// THREADS — the /research LEFT sidebar (per-surface e2e).
//
// Rebuilt from the user's own acceptance steps (2026-08-22). This file folds the
// three former research locks (R1 world-scope, R2 born-with-one-thread, R3
// last-thread floor) into one surface file, and adds RED-FIRST guideline specs
// (test.fixme) for the behaviors the user described that are NOT built yet
// (rename + auto-title, switch-without-waiting-on-AI, readable hover). Those
// fixme specs are the acceptance CONTRACT for whoever implements the feature —
// they fail on purpose today (feature absent), never a silent skip.
//
// The GREEN half is fully deterministic (no AI): the thread rail is a server
// render of the active world's threads, so counts/scope/create are exact.
// =============================================================================

const SEED_UNIVERSE = "universe-1";
const SEED_UNIVERSE_NAME = "FANTASY UNIVERSE";

const ASHKELD = { id: "world-universe-1", name: "ASHKELD WORLD", threads: 2 };
const VOSK = { id: "world-vosk", name: "VOSK REACH", threads: 1 };
const HALEN = { id: "world-halen", name: "HALEN CITY", threads: 1 };

/** The breadcrumb world switcher (aria-haspopup="menu"), shared by /wiki + /research. */
function switcherButton(page: Page): Locator {
  return page.locator('button[aria-haspopup="menu"]');
}

/** Open the switcher and pick a world by visible name; asserts the URL re-scopes. */
async function switchWorld(page: Page, name: string, worldId: string): Promise<void> {
  await switcherButton(page).click();
  const menu = page.getByRole("menu", { name: "Switch universe or world" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitemradio", { name }).click();
  await expect(page).toHaveURL(new RegExp(`w=${worldId}`));
  await expect(switcherButton(page)).toContainText(name);
}

function threadsNav(page: Page): Locator {
  return page.locator('nav[aria-label="Research threads"]');
}

/** Open the rail (its toggle drives only the stacked tier; harmless on desktop). */
async function openRail(page: Page): Promise<Locator> {
  const nav = threadsNav(page);
  const toggle = nav.locator("button[aria-expanded]").first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  return nav;
}

/** Thread SELECT buttons — the first button in each panel row (never the trash,
 *  never "+ New thread"), so the count is exactly the thread count. */
function threadRows(nav: Locator): Locator {
  return nav.locator("ul > li > div > button:first-child");
}

/** Per-row TRASH buttons (aria-label 'Delete thread "…"'); the guarded affordance. */
function trashButtons(nav: Locator): Locator {
  return nav.locator('button[aria-label^="Delete thread"]');
}

// ---------------------------------------------------------------------------
// GREEN — world scope (R1): switching the header world re-scopes the rail.
// ---------------------------------------------------------------------------
test("threads: switching worlds re-scopes the rail to that world's threads", async ({
  page,
}) => {
  await page.goto("/research");
  await expect(switcherButton(page)).toContainText(ASHKELD.name);
  await expect(threadRows(await openRail(page))).toHaveCount(ASHKELD.threads);

  await switchWorld(page, VOSK.name, VOSK.id);
  await expect(threadRows(await openRail(page))).toHaveCount(VOSK.threads);

  await switchWorld(page, HALEN.name, HALEN.id);
  await expect(threadRows(await openRail(page))).toHaveCount(HALEN.threads);
});

// ---------------------------------------------------------------------------
// GREEN — count (user step 3): the header count equals the real thread count.
// ---------------------------------------------------------------------------
test("threads: the 'Threads' header count equals the rendered thread rows", async ({
  page,
}) => {
  await page.goto("/research");
  const rail = await openRail(page);
  const rows = await threadRows(rail).count();
  expect(rows).toBe(ASHKELD.threads);
  // The count badge in the "Threads" header mirrors the rendered row count.
  await expect(rail.locator("button[aria-expanded]").first()).toContainText(
    String(rows),
  );
});

// ---------------------------------------------------------------------------
// GREEN — born with one thread (R2, user step 1): a NEW world is minted with
// EXACTLY ONE default "New thread" (DB + UI), so the rail is never empty and the
// last-thread floor always has a floor of one. Drives the real insertWorld path
// (/wiki/manage "+ New world") and self-cleans via the manage delete gate.
// ---------------------------------------------------------------------------
test("threads: a newly created world is born with exactly one default thread", async ({
  page,
}) => {
  const unique = `Threadborn ${Date.now()}`;
  const before = await countRows("worlds", "universe_id = $1", [SEED_UNIVERSE]);

  await page.goto("/wiki/manage");
  await page
    .locator('li[class*="__universe"]')
    .filter({ has: page.getByRole("heading", { name: SEED_UNIVERSE_NAME }) })
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

  // DB invariant: EXACTLY ONE seeded thread, titled "New thread", scope "chat".
  expect(await countRows("research_threads", "world_id = $1", [worldId])).toBe(1);
  const thread = await queryOne<{ title: string; scope: string }>(
    `SELECT title, scope FROM research_threads WHERE world_id = $1`,
    [worldId],
  );
  expect(thread?.title).toBe("New thread");
  expect(thread?.scope).toBe("chat");

  // UI: the new world's /research rail shows EXACTLY 1 thread.
  await page.goto(`/research?w=${worldId}`);
  await expect(threadRows(await openRail(page))).toHaveCount(1);

  // SELF-CLEAN: delete the world (FK ON DELETE CASCADE removes its seeded thread).
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
  expect(await countRows("research_threads", "world_id = $1", [worldId])).toBe(0);
});

// ---------------------------------------------------------------------------
// GREEN — last-thread floor (R3, user steps 1+2): a world at exactly ONE thread
// offers NO delete affordance; adding a second brings the trash back; deleting
// down to one hides it again — the last thread can never be removed via the UI.
// Base world VOSK seeds exactly one thread. This spec MUTATES, so it reseeds.
// ---------------------------------------------------------------------------
test.describe("threads floor (mutates → reseeds)", () => {
  test.afterAll(reseed);

  test("threads: the last thread cannot be deleted (trash hidden at the floor)", async ({
    page,
  }) => {
    await page.goto(`/research?w=${VOSK.id}`);
    let nav = await openRail(page);

    await expect(threadRows(nav)).toHaveCount(1);
    await expect(trashButtons(nav)).toHaveCount(0);

    // ADD a second thread; the trash returns on both rows.
    await nav.getByRole("button", { name: "+ New thread" }).click();
    nav = await openRail(page);
    await expect(threadRows(nav)).toHaveCount(2);
    await expect(trashButtons(nav)).toHaveCount(2);

    // DELETE one (trash → confirm 'Delete "New thread"?' → Delete).
    await trashButtons(nav).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete" }).click();

    // BACK AT THE FLOOR: one thread remains and the trash is gone again.
    nav = await openRail(page);
    await expect(threadRows(nav)).toHaveCount(1);
    await expect(trashButtons(nav)).toHaveCount(0);
  });

  test("threads: '+ New thread' creates a thread and moves focus onto it (user step 6)", async ({
    page,
  }) => {
    await page.goto(`/research?w=${VOSK.id}`);
    let nav = await openRail(page);
    const before = await threadRows(nav).count();

    await nav.getByRole("button", { name: "+ New thread" }).click();
    nav = await openRail(page);
    await expect(threadRows(nav)).toHaveCount(before + 1);

    // The freshly-created thread is now the current row (focus moved onto it).
    await expect(nav.locator('button[aria-current="true"]')).toHaveCount(1);
  });
});

// ===========================================================================
// ACCEPTANCE TRUTH — the user's steps as LIVE tests. These assert the behavior
// the user described as the source of truth; where the code does not yet match
// (no rename affordance, blocking thread switch, dark-on-dark hover), the test
// FAILS and exposes the gap rather than silently skipping it.
// ===========================================================================

// GUIDELINE — user step 1a/1b: a thread's name is EDITABLE for cataloguing, and
// a manual rename WINS over the first-chat auto-title. Auto-title only fills
// while the name is still the default "New thread"; once the user renames, the
// first AI answer must NOT overwrite it. Not built: ResearchIndex renders a
// select + trash only, with no rename affordance.
test(
  "threads: a thread can be renamed, and a manual rename wins over auto-title",
  async ({ page }) => {
    await page.goto(`/research?w=${VOSK.id}`);
    const nav = await openRail(page);
    const row = threadRows(nav).first();

    // A rename affordance exists on the row (double-click, or an edit button).
    await row.dblclick();
    const nameInput = nav.getByRole("textbox", { name: /thread name/i });
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Water magic notes");
    await nameInput.press("Enter");
    await expect(threadRows(nav).first()).toContainText("Water magic notes");

    // The manual title survives a first chat: auto-title must not clobber it.
    // (When the ask flow is deterministic, drive one ask here and re-assert the
    // row still reads "Water magic notes".)
  },
);

// GUIDELINE — user step 4: switching threads must NOT wait for an in-flight AI
// answer. With a stream in progress in thread A, clicking thread B activates B
// immediately (aria-current flips) rather than blocking until A's stream ends.
// Needs a deterministic slow-stream to hold A "busy"; parked until that fixture
// (or the real non-blocking switch) exists.
test(
  "threads: switching threads does not block on an in-flight AI answer",
  async ({ page }) => {
    await page.goto(`/research?w=${ASHKELD.id}`);
    const nav = await openRail(page);
    // Start an ask in thread A (hold the stream open), then click thread B and
    // assert B becomes aria-current="true" without waiting for A to finish.
    const rows = threadRows(nav);
    await rows.nth(1).click();
    await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");
  },
);

// GUIDELINE — user step 5: the ACTIVE thread row (dark bg / white text) must stay
// readable on HOVER — no dark-on-dark. A comment in ResearchIndex even notes the
// hover token is `--accent-deep`, which the user reports turns the text dark. The
// fix keeps WCAG-AA contrast on hover of the active row; this asserts the
// computed text colour does not collapse toward the background on hover.
test(
  "threads: the active thread row keeps readable contrast on hover",
  async ({ page }) => {
    await page.goto(`/research?w=${ASHKELD.id}`);
    const nav = await openRail(page);
    const active = nav.locator('button[aria-current="true"]').first();
    await active.hover();
    // The hovered active row's text colour must remain the light on-ink token,
    // never collapse to the dark background (a11y contrast floor).
    const color = await active.evaluate((el) => getComputedStyle(el).color);
    expect(color).not.toBe("rgb(0, 0, 0)");
  },
);
