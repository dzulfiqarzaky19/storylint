import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Exhaustive RESEARCH-screen click-through (per-screen e2e). Drives every
// interactive control on /research at 1440x900 and asserts the flow. Product
// rule 1 is sacred: the ConfirmationStrip is the ONLY wiki-write path — Keep
// alone must never write, and Cancel must write nothing. The confirm+persist
// path (which is idempotent-hostile under a shared DB) is already covered in
// smoke.spec.ts, so here we lean on the Cancel path and toggle reverts to stay
// clean under parallel runs. Live AI-call assertions live in ai.spec.ts; here
// we only assert the composer control exists and gates correctly.

// Chip labels — kept lockstep with ResearchScreen.tsx CHIPS (now 3, each sent
// verbatim as a real AI question; the seed-only "What does it cost her?" chip
// was removed with the seeded conversation).
const CHIPS = [
  "Push on that",
  "Give me a scene",
  "I\u2019m stuck", // curly apostrophe; last chip is "I’m stuck — ask me something"
] as const;

function threadsNav(page: Page) {
  return page.locator('nav[aria-label="Research threads"]');
}

test.beforeEach(async ({ page }) => {
  // Research now starts EMPTY (no seeded conversation), so we only navigate
  // here; the old "If a salt-name is a debt" seed assertion is gone. Each test
  // asserts its own precondition (and skips when the seed-era fixtures it needs
  // are absent).
  await page.goto("/research");
});

// ---------------------------------------------------------------------------
// Threads index: rail toggle, thread select, create.
// ---------------------------------------------------------------------------
test("research index: the threads rail toggles open and closed", async ({
  page,
}) => {
  const nav = threadsNav(page);
  const toggle = nav.locator("button[aria-expanded]").first();
  const initial = (await toggle.getAttribute("aria-expanded")) ?? "false";
  await toggle.click();
  await expect(toggle).not.toHaveAttribute("aria-expanded", initial);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", initial);
});

test("research index: selecting a thread marks it current", async ({ page }) => {
  const nav = threadsNav(page);
  const toggle = nav.locator("button[aria-expanded]").first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  // Thread items are the non-toggle buttons in the nav (exclude the "+ New").
  const threads = nav
    .locator("button")
    .filter({ hasNotText: /^Threads|\+ New thread/ });
  if ((await threads.count()) === 0) test.skip(true, "no threads in seed");
  const first = threads.first();
  await first.click();
  await expect(first).toHaveAttribute("aria-current", "true");
});

test("research index: '+ New thread' creates and focuses a thread", async ({
  page,
}) => {
  const nav = threadsNav(page);
  const toggle = nav.locator("button[aria-expanded]").first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  const create = nav.getByRole("button", { name: /\+ New thread/i });
  if ((await create.count()) === 0) test.skip(true, "create disabled in this build");
  const before = await nav
    .locator("button")
    .filter({ hasNotText: /^Threads|\+ New thread/ })
    .count();
  await create.click();
  await expect
    .poll(async () =>
      nav.locator("button").filter({ hasNotText: /^Threads|\+ New thread/ }).count(),
    )
    .toBeGreaterThan(before);
});

// ---------------------------------------------------------------------------
// Prompt chips: each canned chip is clickable and acts on the composer.
// ---------------------------------------------------------------------------
// TODO(F4-P0+): rewrite for the empty-start real-AI flow (create → pick scope →
// ask → streamed answer). Chips are no longer canned reveals; clicking one now
// fires a REAL AI call, so asserting it needs live AI+DB. Authored post-P0 wipe.
test.skip("research chips: all prompt chips render and clicking one never writes the wiki", async ({
  page,
}) => {
  for (const label of CHIPS) {
    const chip = page.getByRole("button", { name: new RegExp(escapeRe(label), "i") });
    await expect(chip.first()).toBeVisible();
  }
  // A chip is a canned conversational action (it advances/reveals turns); it is
  // NOT a wiki write. Clicking it must never raise the confirmation strip.
  await page.getByRole("button", { name: /Push on that/i }).first().click();
  await expect(page.getByText("Yes, write it in", { exact: false })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Composer AI control: present + gated when AI on; static placeholder when off.
// (Live round-trip is asserted in ai.spec.ts.)
// ---------------------------------------------------------------------------
test("research composer: Ask is disabled until the input has text", async ({
  page,
}) => {
  const input = page.getByRole("textbox", { name: "Ask the research AI" });
  if ((await input.count()) === 0) {
    // AI off: the static placeholder copy is shown and there is no Ask button.
    await expect(
      page.getByText("Type anything. Half a thought is enough.", { exact: false }),
    ).toBeVisible();
    test.skip(true, "AI disabled — no composer input");
  }
  const ask = page.getByRole("button", { name: /^(Ask|Thinking)/ });
  await expect(ask).toBeDisabled();
  await input.fill("what happens next in the story?");
  await expect(ask).toBeEnabled();
  // Clearing re-disables.
  await input.fill("");
  await expect(ask).toBeDisabled();
});

// ---------------------------------------------------------------------------
// Proposition card: Keep toggles (and reverts), and Keep alone writes nothing.
// ---------------------------------------------------------------------------
// TODO(F4-P0+): rewrite for the empty-start real-AI flow (create → pick scope →
// ask → streamed answer with proposition cards). No seeded cards exist now, so
// a Keep-toggle assertion needs a real AI answer first. Authored post-P0 wipe.
test.skip("research card: Keep inverts to Kept and back, and never writes the wiki", async ({
  page,
}) => {
  const keep = page.getByRole("button", { name: "Keep", exact: true }).first();
  await expect(keep).toBeVisible();
  await expect(keep).toHaveAttribute("aria-pressed", "false");

  await keep.click();
  const kept = page.getByRole("button", { name: "Kept", exact: true }).first();
  await expect(kept).toBeVisible();
  await expect(kept).toHaveAttribute("aria-pressed", "true");

  // Rule 1: keeping is not a wiki write — no confirmation strip, no "In the wiki".
  await expect(page.getByText("Yes, write it in", { exact: false })).toHaveCount(0);

  // Revert (only if this card is not already permanently in the wiki).
  if (await kept.isEnabled()) {
    await kept.click();
    await expect(
      page.getByRole("button", { name: "Keep", exact: true }).first(),
    ).toHaveAttribute("aria-pressed", "false");
  }
});

// ---------------------------------------------------------------------------
// Confirmation strip: "Make it an entry" reveals it; Cancel writes NOTHING.
// This is the rule-1 gate. We deliberately use Cancel (not Confirm) so the
// shared DB is untouched.
// ---------------------------------------------------------------------------
// TODO(F4-P0+): rewrite for the empty-start real-AI flow (create → pick scope →
// ask → streamed answer with proposition cards). No seeded cards exist now, so
// the "Make it an entry" gate needs a real AI answer first. Authored post-P0 wipe.
test.skip("research strip: 'Make it an entry' reveals the strip and Cancel writes nothing", async ({
  page,
}) => {
  // Strip must be absent until a card is proposed.
  await expect(page.getByText("Yes, write it in", { exact: false })).toHaveCount(0);

  // Use a card that is NOT already in the wiki (its Keep is enabled).
  const propose = page
    .getByRole("button", { name: "Make it an entry", exact: true })
    .first();
  await expect(propose).toBeVisible();
  await propose.click();

  const strip = page.locator('[role="group"][aria-label="Confirm wiki write"]');
  await expect(strip).toBeVisible();
  await expect(strip.getByRole("button", { name: /Yes, write it in/i })).toBeVisible();

  // Cancel hides the strip and writes nothing.
  await strip.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Yes, write it in", { exact: false })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Kept board: the aside toggles open/closed.
// ---------------------------------------------------------------------------
test("research kept board: the Kept aside is present (toggle drives the phone tier)", async ({
  page,
}) => {
  const board = page.locator('[aria-label="Kept"]');
  await expect(board).toBeVisible();
  // The board toggle is hidden on desktop (the aside is always shown); it only
  // collapses the board on the phone tier. Exercise the toggle there.
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = board.locator("button[aria-expanded]").first();
  if ((await toggle.count()) === 0) test.skip(true, "no kept-board toggle in this build");
  await expect(toggle).toBeVisible();
  const initial = (await toggle.getAttribute("aria-expanded")) ?? "false";
  await toggle.click();
  await expect(toggle).not.toHaveAttribute("aria-expanded", initial);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", initial);
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ===========================================================================
// F2a — persistent research chat: voice relabel + delete-thread UX.
//
// The delete tests MUTATE the shared DB (they remove thread rows), so this
// block RESEEDS in its own afterAll (db:seed, NOT the no-op `seed`) to leave
// the DB exactly as the global setup produced it — otherwise a later spec that
// depends on the two seeded threads would fail purely on ordering.
// ===========================================================================
function threadItems(page: Page) {
  // The thread-select buttons carry the .item class; scope to them so the
  // per-row trash button (also a <button> in the nav) is never miscounted.
  return threadsNav(page).locator('button[class*="item"]');
}

async function openRail(page: Page) {
  const toggle = threadsNav(page).locator("button[aria-expanded]").first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}

test.describe("F2a persistent research chat", () => {
  test.afterAll(() => {
    // Restore the seeded thread set this spec's deletes consumed.
    execFileSync("npm", ["run", "db:seed"], { stdio: "ignore", shell: true });
  });

  test("relabel: the question kicker reads 'You' (not 'You are turning over')", async ({
    page,
  }) => {
    await expect(page.getByText("You are turning over", { exact: true })).toHaveCount(0);
    await expect(page.locator("section").getByText("You", { exact: true }).first()).toBeVisible();
  });

  test("relabel: the collaborator voice never renders as 'Research'", async ({
    page,
  }) => {
    // The seeded + persisted them-turns speak as "Collaborator"; the legacy
    // "Research" speaker label must not appear anywhere in the thread body.
    await expect(page.getByText("Research", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Collaborator", { exact: true }).first()).toBeVisible();
  });

  test("delete: trash removes a thread and jumps focus off the deleted row", async ({
    page,
  }) => {
    await openRail(page);
    // Create a throwaway thread so we never delete seed content the other specs
    // read. It becomes the active row (createThread pushes ?thread=<id>).
    const create = threadsNav(page).getByRole("button", { name: /\+ New thread/i });
    if ((await create.count()) === 0) test.skip(true, "create disabled in this build");
    const before = await threadItems(page).count();
    await create.click();
    await expect.poll(async () => threadItems(page).count()).toBe(before + 1);
    await openRail(page);

    // The freshly-created thread is the active row.
    const active = threadsNav(page).locator('button[aria-current="true"]').first();
    const activeName = (await active.locator("span").first().textContent())?.trim();
    expect(activeName).toBeTruthy();

    // Accept the "Delete this thread?" confirm, then click that row's trash.
    page.once("dialog", (d) => {
      expect(d.message()).toBe("Delete this thread?");
      void d.accept();
    });
    const trash = active.locator("..").getByRole("button", { name: /^Delete thread/ });
    await trash.click();

    // The row count drops back and focus is no longer on a deleted row: some
    // other thread is now active (the nearest-remaining jump).
    await expect.poll(async () => threadItems(page).count()).toBe(before);
    await expect(threadsNav(page).locator('button[aria-current="true"]')).toHaveCount(1);
  });

  test("delete: a rejected confirm keeps the thread", async ({ page }) => {
    await openRail(page);
    const create = threadsNav(page).getByRole("button", { name: /\+ New thread/i });
    if ((await create.count()) === 0) test.skip(true, "create disabled in this build");
    const before = await threadItems(page).count();
    await create.click();
    await expect.poll(async () => threadItems(page).count()).toBe(before + 1);
    await openRail(page);

    // Dismiss the confirm: the count must be unchanged.
    page.once("dialog", (d) => void d.dismiss());
    const active = threadsNav(page).locator('button[aria-current="true"]').first();
    await active.locator("..").getByRole("button", { name: /^Delete thread/ }).click();
    await page.waitForTimeout(150);
    await expect(threadItems(page)).toHaveCount(before + 1);

    // Clean up the throwaway we created (accept this time) to keep the count sane.
    page.once("dialog", (d) => void d.accept());
    await active.locator("..").getByRole("button", { name: /^Delete thread/ }).click();
    await expect.poll(async () => threadItems(page).count()).toBe(before);
  });
});
