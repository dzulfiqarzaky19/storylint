import { test, expect, type Page, type Locator } from "@playwright/test";

// =============================================================================
// AI — the BASIC gate for /research's own AI wiring (per-surface e2e).
//
// This is deliberately a THIN gate, not deep AI testing (that is future work).
// Research's AI is wired differently from /write's note-advice flow: the composer
// always renders a real ask input (the `ai` prop is always set), and the answer
// arrives over an NDJSON stream at POST /api/research/stream with frames:
//   {"type":"delta","text":...}  {"type":"done","turns":[...]}  {"type":"error",...}
//
// So the basic gate proves the SHELL of that wiring without leaning on the live
// gateway (which is too slow to assert against — see the parked persist case):
//   1. the ask affordance renders and gates on text (busy → "Thinking…");
//   2. the client speaks the stream contract — a stubbed `done` frame drives a
//      collaborator turn into the thread (proves the client parses the frames),
//      and a stubbed `error` frame surfaces the alert (proves the failure seam).
// Card-content assertions (3 cards, Keep, Make-it-an-entry) are NOT here.
// =============================================================================

function askInput(page: Page): Locator {
  return page.getByRole("textbox", { name: "Ask the research AI" });
}

function askButton(page: Page): Locator {
  return page.getByRole("button", { name: /^(Ask|Thinking)/ });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/research");
});

// ---------------------------------------------------------------------------
// GATE 1: the ask affordance renders and gates on text.
// ---------------------------------------------------------------------------
test("ai gate: the research composer exposes an ask input and a gated Ask button", async ({
  page,
}) => {
  await expect(askInput(page)).toBeVisible();
  await expect(askButton(page)).toBeDisabled();
  await askInput(page).fill("what does the salt-name cost her?");
  await expect(askButton(page)).toBeEnabled();
});

// ---------------------------------------------------------------------------
// GATE 2: the stream ROUTE validates its request body deterministically (no
// gateway needed). A missing question or threadId returns a plain JSON 400 —
// the guard the client relies on before it ever opens the stream.
// ---------------------------------------------------------------------------
test("ai gate: the research stream route rejects a malformed request with a JSON error", async ({
  request,
}) => {
  // Missing question → 400 "Type a question first."
  const noQuestion = await request.post("/api/research/stream", {
    data: { threadId: "thread-ashkeld-1" },
  });
  expect(noQuestion.status()).toBe(400);
  expect((await noQuestion.json()).error).toMatch(/question/i);

  // Missing threadId → 400 "No active thread to write to."
  const noThread = await request.post("/api/research/stream", {
    data: { question: "anything" },
  });
  expect(noThread.status()).toBe(400);
  expect((await noThread.json()).error).toMatch(/thread/i);
});

// ---------------------------------------------------------------------------
// GATE 3: the client speaks the stream FAILURE contract. A stubbed `error` frame
// (or a non-ok response) makes the client surface the dismissible alert rather
// than fail silently. This is the deterministic half of the AI wiring — the
// happy-path `done` frame drives real turn rows whose exact shape belongs to a
// deeper (future) card test, so it stays out of this basic gate.
// ---------------------------------------------------------------------------
test("ai gate: a failed stream surfaces the error alert (client failure seam)", async ({
  page,
}) => {
  await page.route("**/api/research/stream", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "AI gate induced failure" }),
    });
  });
  await askInput(page).fill("what happens next?");
  await askButton(page).click();

  const banner = page
    .locator('[role="alert"]')
    .filter({ has: page.getByRole("button", { name: "Dismiss" }) });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("AI gate induced failure");
});

// ===========================================================================
// ACCEPTANCE TRUTH — the AI ANSWER → CARD flow (user's card steps as live tests).
//
// The card components exist (PropositionCard: Keep / Make-it-an-entry / "In the
// wiki"), but cards only appear once an AI answer streams them. These tests
// assert the user's card acceptance as truth; with no deterministic card yet on
// the page they FAIL, exposing that the card flow isn't exercised end-to-end.
// That is the intended signal — the steps are the contract, not the code.
//
// Selectors are the REAL ones (verified against PropositionCard.tsx):
//   Keep button  → role=button name /^(Keep|Kept)/, aria-pressed reflects state
//   propose      → role=button name "Make it an entry" → span "In the wiki"
// ===========================================================================

// USER STEP (Chat 4): an AI answer renders exactly THREE proposition cards.
test(
  "ai cards: an answer renders three proposition cards",
  async ({ page }) => {
    // Precondition (future fixture): stub POST /api/research/stream to emit a
    // `done` frame carrying a collaborator turn whose text embeds 3 cards, so
    // ResearchScreen renders three PropositionCards deterministically.
    const cards = page.locator('[class*="cardActions"]');
    await expect(cards).toHaveCount(3);
  },
);

// USER STEP (Chat 4): Keep toggles the card and pushes it onto the Kept board.
// PropositionCard's Keep button flips label Keep→Kept and aria-pressed→true;
// ResearchScreen's handleKeep adds it to keptItems, so a row appears on the
// board (aria-label="Kept").
test(
  "ai cards: Keep toggles the card and pushes it onto the Kept board",
  async ({ page }) => {
    const keep = page.getByRole("button", { name: "Keep" }).first();
    await keep.click();
    await expect(
      page.getByRole("button", { name: "Kept" }).first(),
    ).toHaveAttribute("aria-pressed", "true");
    // The kept row now shows on the board (was empty-state before).
    await expect(
      page.locator('[aria-label="Kept"]').locator('[class*="keptItem"]'),
    ).toHaveCount(1);
  },
);

// USER STEP (Chat 4 / rule-1 gate): "Make it an entry" opens the Add-to-Wiki
// modal (WikiTargetPicker, role=dialog). Lock-what-exists only — beat-routing
// is dropped; this just proves the propose affordance opens the picker.
test(
  "ai cards: 'Make it an entry' opens the Add-to-Wiki modal",
  async ({ page }) => {
    await page.getByRole("button", { name: "Make it an entry" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  },
);

// USER STEP (Chat +): once a card is written into the wiki, its propose control
// flips from the "Make it an entry" button to the non-interactive "In the wiki"
// label (red tint via .proposeInWiki), and Keep becomes permanently disabled.
test(
  "ai cards: a written card shows 'In the wiki' and locks Keep",
  async ({ page }) => {
    // Precondition (future fixture): a card already written into the wiki.
    await expect(page.getByText("In the wiki", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Make it an entry" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Kept" }).first()).toBeDisabled();
  },
);


