import { test, expect, type Page, type Locator } from "@playwright/test";

// TCK-HF2 — research error surfacing (HIGH-RISK, user-facing failure path).
//
// state.error is dispatched at 8+ sites in ResearchScreen but, before this
// ticket, NO component read it: stream failures, write-failed, create/delete
// failed all left the reducer holding an error string the UI never showed
// (silent failure). The fix renders state.error as a dismissible role="alert"
// (assertive) live region in the footer, cleared on next ask (the reducer nulls
// state.error on APPEND_STREAMING_TURN) or on explicit Dismiss.
//
// This spec induces a REAL failure by faulting the /api/research/stream POST
// (route → 500 with a JSON error body). The client's `if (!res.ok) throw` path
// dispatches SET_ERROR, so the alert MUST appear. It then proves both clear
// paths: explicit Dismiss, and auto-clear on the next ask (APPEND_STREAMING_TURN
// nulls error synchronously, before the fetch, so it is deterministic without a
// live gateway).
//
// NOTE: Next.js renders a permanent, EMPTY role="alert" route announcer
// (#__next-route-announcer__). A bare getByRole("alert") therefore also matches
// that node, so every assertion here scopes to OUR banner via the errorBar
// (the one alert that carries a Dismiss button / visible error text).

const INDUCED_MESSAGE = "Induced stream failure (TCK-HF2 e2e)";

/** Our error banner: the role="alert" that owns a Dismiss button. */
function errorBanner(page: Page): Locator {
  return page
    .locator('[role="alert"]')
    .filter({ has: page.getByRole("button", { name: "Dismiss" }) });
}

/** Route the research stream POST to a 500 with a JSON error body. */
async function faultStream(page: Page): Promise<void> {
  await page.route("**/api/research/stream", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: INDUCED_MESSAGE }),
    });
  });
}

/** The AI ask input (only present when the composer's ai affordance renders). */
function askInput(page: Page): Locator {
  return page.getByRole("textbox", { name: "Ask the research AI" });
}

async function ask(page: Page, question: string): Promise<void> {
  await askInput(page).fill(question);
  await page.getByRole("button", { name: /^(Ask|Thinking)/ }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/research");
});

test("research error: an induced stream failure surfaces a dismissible role=alert", async ({
  page,
}) => {
  if ((await askInput(page).count()) === 0) {
    test.skip(true, "AI composer disabled — no ask input to drive the failure path");
  }
  await faultStream(page);

  // Our banner is absent before anything fails (the route announcer is empty and
  // owns no Dismiss button, so it never matches errorBanner()).
  await expect(errorBanner(page)).toHaveCount(0);

  await ask(page, "what happens next in the story?");

  // The induced 500 → the client throws the body error → SET_ERROR → the alert
  // renders with that exact message (silent-failure regression is now visible).
  const banner = errorBanner(page);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(INDUCED_MESSAGE);

  // Dismiss clears it.
  await banner.getByRole("button", { name: "Dismiss" }).click();
  await expect(errorBanner(page)).toHaveCount(0);
});

test("research error: the alert auto-clears on the next ask (reducer nulls error)", async ({
  page,
}) => {
  if ((await askInput(page).count()) === 0) {
    test.skip(true, "AI composer disabled — no ask input to drive the failure path");
  }
  await faultStream(page);

  await ask(page, "first question that fails");
  const banner = errorBanner(page);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(INDUCED_MESSAGE);

  // Prove the reducer nulls state.error on the next ask. Stop faulting first so
  // the retry cannot re-raise the SAME induced message: the second ask reaches
  // APPEND_STREAMING_TURN (which sets error: null), clearing the first failure's
  // banner. Whatever the retry then does, the ORIGINAL induced message must be
  // gone — a stale, never-clearing banner would keep it and fail this.
  await page.unroute("**/api/research/stream");
  await ask(page, "second question after unfault");

  await expect(
    page.locator('[role="alert"]', { hasText: INDUCED_MESSAGE }),
  ).toHaveCount(0);
});
