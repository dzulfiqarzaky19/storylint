import { test, expect, type Page } from "@playwright/test";

// T-RESEARCH-LOCK-1 (R1): lock the ALREADY-BUILT world-scoping of /research.
//
// No app change — this is a pure, DETERMINISTIC (no-AI) e2e lock. It proves that
// switching the active world in the header re-scopes /research to THAT world's
// threads and re-scopes /wiki to THAT world's entries, never a sibling world's.
//
// WHY these three assertions (fish's audit, 2026-08-21):
//   - The research thread RAIL is a deterministic server render of the active
//     world's threads. Seed: Ashkeld has 2 threads, Vosk 1, Halen 1 — so the rail
//     COUNT changing across a switch is a clean, AI-free scope signal.
//   - /research surfaces wiki entries only via AI proposition cards (a live call),
//     so entry ISOLATION is asserted on /wiki instead: a Halen-only entry is
//     ABSENT after switching to Vosk, and a Vosk-only entry is PRESENT — seed names
//     are cross-world distinct (no overlaps), so presence/absence is unambiguous.
//   - The URL ?w=<worldId> is the scope contract both surfaces read.
//
// READ-ONLY (navigate + read); it MUTATES nothing, so it does NOT reseed.

const ASHKELD = { id: "world-universe-1", name: "ASHKELD WORLD", threads: 2 };
const VOSK = { id: "world-vosk", name: "VOSK REACH", threads: 1 };
const HALEN = { id: "world-halen", name: "HALEN CITY", threads: 1 };

// A Halen-only entry and a Vosk-only entry (fish audit: no cross-world name overlap).
const HALEN_ONLY_ENTRY = "Det. Ana Reyes";
const VOSK_ONLY_ENTRY = "Sable Cauth";

/** The breadcrumb world switcher (aria-haspopup="menu"), shared by /wiki + /research. */
function switcherButton(page: Page) {
  return page.locator('button[aria-haspopup="menu"]');
}

/** Open the switcher and pick a world by its visible name; asserts the URL re-scopes. */
async function switchWorld(page: Page, name: string, worldId: string) {
  await switcherButton(page).click();
  const menu = page.getByRole("menu", { name: "Switch universe or world" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitemradio", { name }).click();
  await expect(page).toHaveURL(new RegExp(`w=${worldId}`));
  await expect(switcherButton(page)).toContainText(name);
}

/** The research thread rail; count = the thread SELECT buttons (one per thread). */
function threadsNav(page: Page) {
  return page.locator('nav[aria-label="Research threads"]');
}

async function threadRows(page: Page) {
  const nav = threadsNav(page);
  const toggle = nav.locator("button[aria-expanded]").first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  // Each thread row renders a SELECT button plus, when a world has >1 thread, a
  // per-row TRASH button (aria-label 'Delete thread "…"'). Count the select
  // buttons only — the first button in each panel <li> — so the trash affordance
  // (and the toggle + "+ New thread") never inflate the thread count.
  return nav.locator("ul > li > div > button:first-child");
}

test("R1: switching worlds re-scopes the /research thread rail to that world's threads", async ({
  page,
}) => {
  // Ashkeld (default): the rail shows its TWO seeded threads.
  await page.goto("/research");
  await expect(switcherButton(page)).toContainText(ASHKELD.name);
  await expect(await threadRows(page)).toHaveCount(ASHKELD.threads);

  // Switch to Vosk (same universe): the rail collapses to its ONE thread.
  await switchWorld(page, VOSK.name, VOSK.id);
  await expect(await threadRows(page)).toHaveCount(VOSK.threads);

  // Switch to Halen (a DIFFERENT universe): its ONE thread, not a sibling's.
  await switchWorld(page, HALEN.name, HALEN.id);
  await expect(await threadRows(page)).toHaveCount(HALEN.threads);
});

test("R1: the active world's /wiki shows only that world's entries (cross-world isolation)", async ({
  page,
}) => {
  // On Vosk's wiki, a Vosk-only entry is present and a Halen-only entry is absent.
  await page.goto("/wiki");
  await switchWorld(page, VOSK.name, VOSK.id);
  const wikiIndex = page.locator('nav[aria-label="The world"]');
  await expect(wikiIndex.getByText(VOSK_ONLY_ENTRY, { exact: false })).toBeVisible();
  await expect(wikiIndex.getByText(HALEN_ONLY_ENTRY, { exact: false })).toHaveCount(0);
});
