import { test, expect, type Page, type Locator } from "@playwright/test";

// =============================================================================
// CHAT — the /research MAIN column (per-surface e2e).
//
// Rebuilt from the user's acceptance steps (2026-08-22). GREEN half locks the
// deterministic, no-AI shell of the chat surface: the empty-state guidance, the
// composer + Ask gate, the Me/Collaborator voice labels, and the stream-error
// alert (induced 500, both clear paths). The card-dependent flow (3 cards, Keep,
// "Make it an entry" → Add-to-Wiki modal, "In the wiki" flip) needs a real AI
// answer to produce cards and is DELIBERATELY not deep-tested here — see
// ai.spec.ts for the basic AI gate; deeper card testing is future work.
//
// The mobile 2-row chip layout the user wants is asserted live at the tail as
// an acceptance-truth test; it fails today if the layout still stacks to 3 rows.
// =============================================================================

const INDUCED_MESSAGE = "Induced stream failure (research chat e2e)";

/** The AI ask input (research always renders it; the composer's `ai` prop is set). */
function askInput(page: Page): Locator {
  return page.getByRole("textbox", { name: "Ask the research AI" });
}

/** Our error banner: the role="alert" that owns a Dismiss button (Next.js also
 *  renders a permanent EMPTY role=alert route announcer, which owns no Dismiss). */
function errorBanner(page: Page): Locator {
  return page
    .locator('[role="alert"]')
    .filter({ has: page.getByRole("button", { name: "Dismiss" }) });
}

/** Fault the research stream POST → 500 with a JSON error body. */
async function faultStream(page: Page): Promise<void> {
  await page.route("**/api/research/stream", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: INDUCED_MESSAGE }),
    });
  });
}

async function ask(page: Page, question: string): Promise<void> {
  await askInput(page).fill(question);
  await page.getByRole("button", { name: /^(Ask|Thinking)/ }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/research");
});

// ---------------------------------------------------------------------------
// GREEN — empty-state (user step 1): guidance copy + composer placeholder.
// ---------------------------------------------------------------------------
test("chat: the empty thread shows the guidance copy and the composer placeholder", async ({
  page,
}) => {
  await expect(
    page.getByText("Ask me anything about your story", { exact: false }),
  ).toBeVisible();
  await expect(askInput(page)).toHaveAttribute(
    "placeholder",
    "Type anything. Half a thought is enough.",
  );
});

// ---------------------------------------------------------------------------
// GREEN — composer gate (user step 1): the red Ask button is disabled until the
// input has text, and re-disables when cleared.
// ---------------------------------------------------------------------------
test("chat: Ask is disabled until the input has text", async ({ page }) => {
  const input = askInput(page);
  const ask = page.getByRole("button", { name: /^(Ask|Thinking)/ });
  await expect(ask).toBeDisabled();
  await input.fill("what happens next in the story?");
  await expect(ask).toBeEnabled();
  await input.fill("");
  await expect(ask).toBeDisabled();
});

// ---------------------------------------------------------------------------
// GREEN — the two prompt chips (user step 1): "Give me a scene" + "I'm stuck…".
// ---------------------------------------------------------------------------
test("chat: both prompt chips render below the composer", async ({ page }) => {
  await expect(
    page.getByRole("button", { name: /Give me a scene/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /I.?m stuck/i }),
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// GREEN — voice labels (user step 3): a turn reads "You" / "Collaborator",
// never the legacy "Research" speaker label.
// ---------------------------------------------------------------------------
test("chat: turns speak as 'You' / 'Collaborator', never 'Research'", async ({
  page,
}) => {
  await expect(page.getByText("You are turning over", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Research", { exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// GREEN — stream error surfacing: an induced 500 shows a dismissible role=alert
// (silent-failure regression is visible), and it clears on Dismiss.
// ---------------------------------------------------------------------------
test("chat: an induced stream failure surfaces a dismissible alert", async ({
  page,
}) => {
  await faultStream(page);
  await expect(errorBanner(page)).toHaveCount(0);

  await ask(page, "what happens next in the story?");

  const banner = errorBanner(page);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(INDUCED_MESSAGE);

  await banner.getByRole("button", { name: "Dismiss" }).click();
  await expect(errorBanner(page)).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// GREEN — the alert auto-clears on the next ask (the reducer nulls state.error
// on APPEND_STREAMING_TURN, synchronously before the fetch).
// ---------------------------------------------------------------------------
test("chat: the error alert auto-clears on the next ask", async ({ page }) => {
  await faultStream(page);

  await ask(page, "first question that fails");
  const banner = errorBanner(page);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(INDUCED_MESSAGE);

  // Stop faulting so the retry cannot re-raise the SAME induced message; the
  // next ask reaches APPEND_STREAMING_TURN (error: null), clearing the banner.
  await page.unroute("**/api/research/stream");
  await ask(page, "second question after unfault");

  await expect(
    page.locator('[role="alert"]', { hasText: INDUCED_MESSAGE }),
  ).toHaveCount(0);
});

// ===========================================================================
// ACCEPTANCE TRUTH — user step 2: on MOBILE the composer + two chips must fall on
// TWO rows, not three. Row 1 = the composer; row 2 = the two chips SIDE BY SIDE
// ("Give me a scene" | "I'm stuck"). This asserts both chips' vertical centres
// coincide (same row) at ~390px. If today they stack to three rows, this FAILS
// and exposes the layout bug — that is the intended signal.
// ===========================================================================
test(
  "chat: on mobile the two chips share one row (2-row composer, not 3)",
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const scene = page.getByRole("button", { name: /Give me a scene/i });
    const stuck = page.getByRole("button", { name: /I.?m stuck/i });
    const a = await scene.boundingBox();
    const b = await stuck.boundingBox();
    expect(a && b).toBeTruthy();
    // Same row: their vertical centres are within a few px of each other.
    const ca = a!.y + a!.height / 2;
    const cb = b!.y + b!.height / 2;
    expect(Math.abs(ca - cb)).toBeLessThan(8);
  },
);
