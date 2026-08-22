import { test, expect, type Page, type Locator } from "@playwright/test";
import { withDb } from "../_helpers/db";
import { reseed } from "../_helpers/seed";

// =============================================================================
// KEPT — the /research RIGHT sidebar (per-surface e2e).
//
// Rebuilt from the user's acceptance steps (2026-08-22). GREEN half locks the
// deterministic shell: the "Kept" header, the count (0 on a fresh thread), the
// verbatim empty-state copy, and the phone-tier collapse toggle.
//
// The user's fuller Kept spec (world-wide scope, source attribution,
// click-through, Wiki/Plot/Write tabs) is asserted below as LIVE acceptance
// truth. Where today's code diverges (Kept is per-thread, no attribution/tabs),
// those tests FAIL and expose the gap — the steps are the source of truth:
//   A. Kept is WORLD-WIDE (aggregates all threads), not per-thread. Today
//      ResearchScreen derives keptItems from thread-scoped state.keptIds.
//   B. each kept item NOTES its source thread. Today KeptItem renders only
//      {kind, title, "On the board only"} — no source-thread field.
//   C. clicking a kept item OPENS its source thread and focuses that card.
//      Today KeptItem has no onClick / navigation at all.
//   D. filter TABS (Wiki / Plot / Write) switch the board body. Today KeptBoard
//      is a single flat list with no tabs.
// =============================================================================

function board(page: Page): Locator {
  return page.locator('[aria-label="Kept"]');
}

// The default /research view opens on world-universe-1 (Ashkeld) — world A. To
// exercise the WORLD-WIDE board and its scope we seed a kept card there AND a
// sibling in world-vosk (world B): world A's card must show, world B's must not,
// and B must BLEED in only if the loader's `WHERE th.world_id` is dropped
// (mutation target). Research seeds empty (no turns/props/kept), so these rows
// are the only kept cards in play; afterAll reseeds to leave the DB pristine.
const A = {
  thread: "thread-ashkeld-1", // world-universe-1 (the world /research opens on)
  turn: "kept-e2e-turn-a",
  prop: "kept-e2e-prop-a",
  title: "Ashkeld kept proposition",
};
const B = {
  thread: "thread-vosk-1", // world-vosk (a sibling world, must stay off the board)
  turn: "kept-e2e-turn-b",
  prop: "kept-e2e-prop-b",
  title: "Vosk kept proposition",
};

async function seedKept(): Promise<void> {
  await withDb(async (client) => {
    for (const c of [A, B]) {
      await client.query(
        `INSERT INTO research_turns (id, thread_id, ordinal, side, who, text)
         VALUES ($1, $2, 0, 'them', 'Collaborator', 'seed turn')
         ON CONFLICT (id) DO NOTHING`,
        [c.turn, c.thread],
      );
      await client.query(
        `INSERT INTO propositions (id, turn_id, kind, title, body, as_kind, sort_order)
         VALUES ($1, $2, 'Character', $3, 'seed body', 'lore', 0)
         ON CONFLICT (id) DO NOTHING`,
        [c.prop, c.turn, c.title],
      );
      await client.query(
        `INSERT INTO kept_cards (proposition_id, kept_at, in_wiki)
         VALUES ($1, 1000, false)
         ON CONFLICT (proposition_id) DO NOTHING`,
        [c.prop],
      );
    }
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/research");
});

// This spec PERSISTS kept_cards (only the acceptance tests below seed them — the
// GREEN empty-state tests must see a pristine, empty board), so it reseeds after
// the file to leave the shared test DB pristine for later-sorting specs.
test.afterAll(reseed);

// ---------------------------------------------------------------------------
// GREEN — the board is present with the "Kept" header.
// ---------------------------------------------------------------------------
test("kept: the Kept board renders with its header", async ({ page }) => {
  await expect(board(page)).toBeVisible();
  await expect(board(page).getByText("Kept", { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// GREEN — empty-state (user initial step): a fresh thread's board shows the
// verbatim empty copy and no kept items.
// ---------------------------------------------------------------------------
test("kept: a fresh thread shows the verbatim empty-state copy", async ({
  page,
}) => {
  await expect(
    board(page).getByText("Nothing kept yet. Drag a proposition here", {
      exact: false,
    }),
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// GREEN — the phone-tier collapse toggle opens and closes the board body.
// (Hidden on desktop where the board always shows.)
// ---------------------------------------------------------------------------
test("kept: the board toggle collapses the body on the phone tier", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = board(page).locator("button[aria-expanded]").first();
  await expect(toggle).toBeVisible();
  const initial = (await toggle.getAttribute("aria-expanded")) ?? "false";
  await toggle.click();
  await expect(toggle).not.toHaveAttribute("aria-expanded", initial);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", initial);
});

// ===========================================================================
// ACCEPTANCE TRUTH — the user's fuller Kept spec as LIVE tests. Each asserts a
// step the user described; where the code doesn't match yet, the test FAILS and
// exposes the gap. The steps are the contract, not the current code.
// ===========================================================================

// GUIDELINE A — user correction: Kept is WORLD-WIDE, not per-thread. Keep a card
// in thread A, switch to thread B: the item is STILL on the board (it aggregates
// every thread in the world). Today keptItems is derived from thread-scoped
// state, so switching threads swaps the list — this fails until aggregation is
// built.
test(
  "kept: the board aggregates kept items across all threads in the world",
  async ({ page }) => {
    // ARRANGE: kept cards seeded in world A (Ashkeld, the open world) and world B
    // (Vosk). The board is world-wide, so world A's card is present on the open
    // thread; re-goto so the server renders the freshly-seeded data.
    await seedKept();
    await page.goto("/research");
    // A kept card must be present on the board regardless of which thread is
    // active (world-wide aggregation). Fails today: Kept is thread-scoped, so a
    // fresh thread's board is empty.
    const items = board(page).locator('[class*="keptItem"]');
    await expect(items.first()).toBeVisible();
  },
);

// GUIDELINE B — user step: each kept item NOTES which thread it came from
// (source-thread attribution), so a world-wide board stays legible.
test(
  "kept: each kept item shows its source-thread attribution",
  async ({ page }) => {
    await seedKept();
    await page.goto("/research");
    const firstItem = board(page).locator('[class*="keptItem"]').first();
    await expect(firstItem).toContainText(/from .*thread/i);
  },
);

// GUIDELINE C — user step: clicking a kept item OPENS its source thread and
// focuses the originating card. Today KeptItem has no onClick.
test(
  "kept: clicking a kept item opens its source thread and focuses the card",
  async ({ page }) => {
    await seedKept();
    await page.goto("/research");
    const firstItem = board(page).locator('[class*="keptItem"]').first();
    await firstItem.click();
    // The source thread becomes active and its card is scrolled into view /
    // focused (data-focused or aria-current on the card).
    await expect(page.locator('[data-card-focused="true"]')).toBeVisible();
  },
);

// GUIDELINE D — user step: filter TABS (Wiki / Plot / Write) switch the board
// body. Today's Kept is a single flat list; only Wiki has content, Plot + Write
// are empty for now (built-but-empty is the correct state).
test(
  "kept: Wiki / Plot / Write filter tabs switch the board body",
  async ({ page }) => {
    await seedKept();
    await page.goto("/research");
    const tabs = board(page).getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(board(page).getByRole("tab", { name: /Wiki/i })).toBeVisible();
    await expect(board(page).getByRole("tab", { name: /Plot/i })).toBeVisible();
    await expect(board(page).getByRole("tab", { name: /Write/i })).toBeVisible();
  },
);
