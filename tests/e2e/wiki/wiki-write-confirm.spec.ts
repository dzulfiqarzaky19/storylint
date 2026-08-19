import { test, expect } from "@playwright/test";
import { queryOne } from "../_helpers/db";
import { reseed } from "../_helpers/seed";

// -----------------------------------------------------------------------------
// WIKI-WRITE CONFIRMATION (integration, DB read-back).
//
// PRODUCT RULE 1 — "Nothing enters the wiki without an explicit confirmation."
// smoke.spec.ts already proves the WikiTargetPicker write drops the card off the
// Kept board. This file goes one layer deeper and proves the confirmed
// write actually LANDS IN POSTGRES: after the confirmation, a real `entries` row
// exists (id `prop-<propositionId>`) and its `kept_cards.in_wiki` flag is TRUE.
// It also proves the negative half of the rule — that BEFORE a confirmation, no
// such entry exists — so the read-back cannot false-green on seeded data.
//
// Deterministic on purpose: the whole flow (Keep -> Make it an entry -> Yes)
// goes through `confirmCard`, which needs NO AI, so this runs green with or
// without SAAROUTERS_API_KEY. `db:seed` TRUNCATEs kept_cards so we start from a
// clean board every run.
//
// Gotchas: Playwright drives `next start -p 3100` (production build) with a live
// Postgres; the read-back opens its own pg Client on DATABASE_URL (same env the
// app uses). Serial only (fullyParallel:false) so the DB isn't raced.
// -----------------------------------------------------------------------------

// db:seed TRUNCATEs kept_cards + entries (runtime state), giving each run a
// clean board. This spec WRITES a prop-* entry + flips in_wiki, so it also
// reseeds in its OWN afterAll to leave the DB pristine for later-sorting specs.
test.beforeAll(reseed);
test.afterAll(reseed);

test("wiki write: confirming a research card LANDS the fact in Postgres (product rule 1)", async ({
  page,
}) => {
  // --- Negative half: a fresh seeded board has written NO card into the wiki. ---
  const before = await queryOne<{ n: string }>(
    "SELECT count(*)::text AS n FROM entries WHERE id LIKE 'prop-%'",
  );
  expect(before?.n).toBe("0");
  const flaggedBefore = await queryOne<{ n: string }>(
    "SELECT count(*)::text AS n FROM kept_cards WHERE in_wiki = TRUE",
  );
  expect(flaggedBefore?.n).toBe("0");

  await page.goto("/research");
  await expect(
    page.getByText("If a salt-name is a debt", { exact: false }),
  ).toBeVisible();

  // Keep a card, make it an entry, and confirm — the ONLY wiki-write path here.
  await page.getByRole("button", { name: "Keep", exact: true }).first().click();
  await page
    .getByRole("button", { name: "Make it an entry", exact: true })
    .first()
    .click();
  const modal = page.getByRole("dialog", { name: "Add to the wiki" });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: /Create entry|Add detail/ }).click();
  await expect(modal).toHaveCount(0);

  // The UI reflects the write (guard so the read-back races nothing). Since the
  // slice-C decision, "In the wiki" shows on the Threads card only (the written
  // card drops off the Kept board), so scope the assertion to a thread turn.
  await expect(
    page.locator('[class*="turn"]').getByText("In the wiki", { exact: false }).first(),
  ).toBeVisible();

  // --- Positive half: the fact actually persisted to Postgres. ---
  // A real entries row was written through the confirmed path (id `prop-<id>`).
  const entry = await queryOne<{ id: string; name: string }>(
    "SELECT id, name FROM entries WHERE id LIKE 'prop-%' ORDER BY sort_order DESC LIMIT 1",
  );
  expect(entry, "a prop-* entry must exist after confirmation").not.toBeNull();
  expect(entry!.id).toMatch(/^prop-/);
  expect((entry!.name ?? "").length).toBeGreaterThan(0);

  // And the kept card is flagged in_wiki = TRUE (board <-> wiki stay in sync).
  const flagged = await queryOne<{ n: string }>(
    "SELECT count(*)::text AS n FROM kept_cards WHERE in_wiki = TRUE",
  );
  expect(Number(flagged?.n)).toBeGreaterThanOrEqual(1);
});
