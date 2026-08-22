import { test, expect, type Page, type Locator } from "@playwright/test";
import { reseed } from "../_helpers/seed";

// =============================================================================
// RESEARCH JOURNEY — one continuous cross-surface user story.
//
// The per-surface specs (threads / chat / ai / kept) each lock ONE surface in
// isolation. This journey is the regression net the user actually asked for: it
// walks a SINGLE arc across the header, the threads rail, the chat composer, and
// the kept board in one browser context, so a change that fixes one surface but
// breaks a neighbour ("fix one, break another") fails HERE even when every
// siloed spec still passes.
//
// It drives ONLY built, deterministic (no-AI) behavior — the unbuilt steps live
// as their own live acceptance-truth tests in the surface files, not here. It MUTATES the
// thread set (creates + deletes a throwaway), so it reseeds in its own afterAll.
// =============================================================================

const ASHKELD = { id: "world-universe-1", name: "ASHKELD WORLD", threads: 2 };
const VOSK = { id: "world-vosk", name: "VOSK REACH", threads: 1 };

function switcherButton(page: Page): Locator {
  return page.locator('button[aria-haspopup="menu"]');
}

function threadsNav(page: Page): Locator {
  return page.locator('nav[aria-label="Research threads"]');
}

async function openRail(page: Page): Promise<Locator> {
  const nav = threadsNav(page);
  const toggle = nav.locator("button[aria-expanded]").first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  return nav;
}

function threadRows(nav: Locator): Locator {
  return nav.locator("ul > li > div > button:first-child");
}

function trashButtons(nav: Locator): Locator {
  return nav.locator('button[aria-label^="Delete thread"]');
}

test.afterAll(reseed);

test("research journey: header → rail → compose → kept, all in one arc", async ({
  page,
}) => {
  // 1. HEADER: land on /research; the active world shows top-left (user step 1).
  await page.goto("/research");
  await expect(switcherButton(page)).toContainText(ASHKELD.name);

  // 2. THREADS: the rail shows this world's two seeded threads, header count matches.
  let nav = await openRail(page);
  await expect(threadRows(nav)).toHaveCount(ASHKELD.threads);
  await expect(nav.locator("button[aria-expanded]").first()).toContainText(
    String(ASHKELD.threads),
  );

  // 3. CHAT: the composer + gated Ask + both chips are present on this thread.
  const input = page.getByRole("textbox", { name: "Ask the research AI" });
  await expect(input).toBeVisible();
  const ask = page.getByRole("button", { name: /^(Ask|Thinking)/ });
  await expect(ask).toBeDisabled();
  await input.fill("what happens next in the story?");
  await expect(ask).toBeEnabled();
  await input.fill("");
  await expect(page.getByRole("button", { name: /Give me a scene/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /I.?m stuck/i })).toBeVisible();

  // 4. KEPT: the right board is present, empty on this fresh thread.
  const board = page.locator('[aria-label="Kept"]');
  await expect(board).toBeVisible();
  await expect(
    board.getByText("Nothing kept yet. Drag a proposition here", { exact: false }),
  ).toBeVisible();

  // 5. CROSS-SURFACE: switch worlds; EVERY surface re-scopes together. Vosk has
  // ONE thread (rail collapses), its last thread offers no trash (floor), and
  // the chat + kept surfaces still render for the new world — the exact
  // "did switching worlds break a neighbour surface?" regression net.
  await switcherButton(page).click();
  const menu = page.getByRole("menu", { name: "Switch universe or world" });
  await menu.getByRole("menuitemradio", { name: VOSK.name }).click();
  await expect(page).toHaveURL(new RegExp(`w=${VOSK.id}`));

  nav = await openRail(page);
  await expect(threadRows(nav)).toHaveCount(VOSK.threads);
  await expect(trashButtons(nav)).toHaveCount(0); // last-thread floor holds
  await expect(page.getByRole("textbox", { name: "Ask the research AI" })).toBeVisible();
  await expect(page.locator('[aria-label="Kept"]')).toBeVisible();

  // 6. CREATE + DELETE a throwaway thread on Vosk: the trash appears at 2 and the
  // floor re-arms at 1 — the create/delete arc leaves the world exactly as found.
  await nav.getByRole("button", { name: "+ New thread" }).click();
  nav = await openRail(page);
  await expect(threadRows(nav)).toHaveCount(2);
  await expect(trashButtons(nav)).toHaveCount(2);
  await trashButtons(nav).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();
  nav = await openRail(page);
  await expect(threadRows(nav)).toHaveCount(1);
  await expect(trashButtons(nav)).toHaveCount(0);
});
