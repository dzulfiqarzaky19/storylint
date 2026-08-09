import { test, expect, type Page, type Locator } from "@playwright/test";
import { reseed } from "./_helpers/seed";
import { RAIL, railRows } from "./_helpers/rail";

// -----------------------------------------------------------------------------
// WRITE — CONFLICT PATH (integration). The seeded Chapter 7 emits TWO conflict
// marks ("nineteen and sworn", "Her own grey eyes") plus two unrecorded marks.
// Several tests here PERSIST a resolution to resolved_marks (a 'leave' survives
// reload), so a spec that pins a SPECIFIC conflict cannot rely on the shared DB
// staying pristine across tests. We therefore reseed the canonical 4-mark state
// before EVERY test (serial run, workers=1, so the reseed can't race), making
// each test fully order-independent.
//
//   • the contradiction note is in the gazetteer voice and offers exactly the
//     three conflict actions in order (wiki / change-the-sentence / leave);
//   • PRODUCT RULE 1: "The wiki is out of date" NEVER writes the wiki — it
//     surfaces the gazetteer notice, closes the note, and leaves the mark
//     outstanding, with the manuscript prose untouched;
//   • "It's deliberate, leave it" drops THAT contradiction specifically;
//   • the RIGHT PANEL (rail) drops a resolved conflict's row and, when every
//     mark is cleared, falls back to its "Nothing outstanding" state.
//
// Gotchas (shared with write-lifecycle.spec.ts): the inline note is portalled
// INTO .ProseMirror; rail rows are scoped to the Outstanding-marks aside; only
// trusted (Playwright) clicks flip real toggles.
// -----------------------------------------------------------------------------

/** Manuscript prose only (excludes the portalled inline-note text). */
async function manuscriptText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const pm = document.querySelector(".ProseMirror");
    if (!pm) return "";
    const parts: string[] = [];
    for (const p of Array.from(pm.querySelectorAll(":scope > p"))) {
      if (p.querySelector("[data-write-note-host]")) {
        const clone = p.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("[data-write-note-host]").forEach((n) => n.remove());
        parts.push((clone.textContent ?? "").trim());
      } else {
        parts.push((p.textContent ?? "").trim());
      }
    }
    return parts.join("\n").trim();
  });
}

/** The set of deduped mark keys currently underlined in the manuscript. */
async function underlinedKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const keys = new Set<string>();
    document.querySelectorAll(".ProseMirror [data-mark-key]").forEach((el) => {
      const k = el.getAttribute("data-mark-key");
      if (k) keys.add(k);
    });
    return Array.from(keys);
  });
}

/** Open the conflict mark whose rail row contains `quote`; returns the note. */
async function openConflict(page: Page, quote: string): Promise<Locator> {
  const row = railRows(page).filter({ hasText: quote });
  await expect(row).toHaveCount(1);
  await row.click();
  const note = page.getByTestId("write-inline-note");
  await expect(note).toBeVisible();
  return note;
}

// EXCEPTION to the suite-wide "afterAll-only" reseed rule: this spec reseeds
// per-TEST on purpose. The tests here are order-dependent because they PERSIST
// resolutions — e.g. the "leave it" test drops a resolved_mark that would
// otherwise starve the later "drop a row" / "empty the panel" tests of the
// grey-eyes conflict. A per-test reseed makes each test start from the canonical
// 4-mark Chapter 7, fully order-independent. Do NOT "optimize" this into a
// beforeAll: it would silently reintroduce cross-test bleed. (Serial run,
// workers=1, so the reseed can't race.)
test.beforeEach(async ({ page }) => {
  reseed();
  await page.goto("/write");
  // The seeded Chapter 7 renders and the engine has produced its conflict marks.
  await expect(
    railRows(page).filter({ hasText: "Her own grey eyes" }),
  ).toHaveCount(1);
});

// Leave the DB pristine for later-running specs (files run alphabetically).
// Several tests here PERSIST a resolution to resolved_marks; without this,
// files that sort after us (write-lifecycle.spec.ts, write.spec.ts) inherit our
// suppressed Chapter 7 marks, render zero underlines, and fail. One reseed after
// this file restores the canonical 4-mark state for downstream specs.
test.afterAll(reseed);

// A conflict note reads in the gazetteer voice and offers exactly the three
// contradiction actions in order: wiki / "Change the sentence" / leave.
test("write conflict: note shows the contradiction voice and the three conflict actions", async ({
  page,
}) => {
  const note = await openConflict(page, "Her own grey eyes");

  await expect(note).toContainText(/contradicts the gazetteer/i);

  const actions = note.locator("button:not([data-testid])");
  await expect(actions).toHaveCount(3);
  await expect(actions.nth(0)).toContainText(/wiki is out of date/i);
  await expect(actions.nth(1)).toContainText(/change the sentence/i);
  await expect(actions.nth(2)).toContainText(/deliberate|leave it/i);
});

// PRODUCT RULE 1 (sacred) — "The wiki is out of date" must NEVER write the wiki.
// It surfaces the gazetteer notice, closes the note, and LEAVES the mark
// outstanding (only a confirmed wiki write, elsewhere, resolves it). The
// manuscript prose is untouched.
test("write conflict: 'the wiki is out of date' never writes the wiki (product rule 1)", async ({
  page,
}) => {
  const note = await openConflict(page, "Her own grey eyes");

  const proseBefore = await manuscriptText(page);
  const rowsBefore = await railRows(page).count();
  const keysBefore = await underlinedKeys(page);

  // Primary action: "The wiki is out of date — change it".
  await note.locator("button:not([data-testid])").first().click();

  // The note closes …
  await expect(page.getByTestId("write-inline-note")).toHaveCount(0);
  // … a gazetteer notice is surfaced (the confirmed wiki write lives elsewhere) …
  await expect(page.locator('p[role="status"]')).toContainText(
    /nothing enters the gazetteer without a yes/i,
  );
  // … the mark is NOT resolved: the row count and the underline set are intact …
  await expect(railRows(page)).toHaveCount(rowsBefore);
  const keysAfter = await underlinedKeys(page);
  expect(keysAfter.sort()).toEqual(keysBefore.sort());
  // … the conflict is still underlined …
  await expect(
    page.locator(".ProseMirror .write-underline-conflict").first(),
  ).toBeVisible();
  // … and NOTHING was written into the manuscript prose.
  expect(await manuscriptText(page)).toBe(proseBefore);
});

// "It's deliberate, leave it" resolves THAT conflict specifically: the grey-eyes
// row + underline clear, while the other conflict ("nineteen and sworn") stays.
test("write conflict: 'leave it' drops that specific contradiction and no other", async ({
  page,
}) => {
  const target = "Her own grey eyes";
  const other = "nineteen and sworn";

  await expect(railRows(page).filter({ hasText: target })).toHaveCount(1);
  await expect(railRows(page).filter({ hasText: other })).toHaveCount(1);

  const note = await openConflict(page, target);
  const rowsBefore = await railRows(page).count();

  // Last action = "It's deliberate, leave it" → dismissal.
  await note.locator("button:not([data-testid])").last().click();
  await expect(page.getByTestId("write-inline-note")).toHaveCount(0);

  // The target conflict row is gone; the other conflict remains.
  await expect(railRows(page).filter({ hasText: target })).toHaveCount(0);
  await expect(railRows(page).filter({ hasText: other })).toHaveCount(1);
  await expect(railRows(page)).toHaveCount(rowsBefore - 1);

  // The grey-eyes run is no longer underlined.
  await expect(
    page.locator(".ProseMirror [data-mark-key]", { hasText: target }),
  ).toHaveCount(0);
});

// RIGHT PANEL (rail) removal — resolving a conflict must drop its row from the
// Outstanding-marks aside specifically (not just clear the underline). This
// pins the rail as the source of truth the writer reads: the resolved conflict
// leaves the panel, the count decrements by exactly one, and every remaining
// row is a DIFFERENT mark. Complements the underline check above.
test("write conflict: the right panel drops a resolved conflict row and keeps the rest", async ({
  page,
}) => {
  const target = "Her own grey eyes";

  const rowsBefore = await railRows(page).count();
  const quotesBefore = await railRows(page).allInnerTexts();
  expect(rowsBefore).toBeGreaterThanOrEqual(2);
  expect(quotesBefore.some((t) => t.includes(target))).toBe(true);

  // Resolve THIS conflict via "It's deliberate, leave it".
  const note = await openConflict(page, target);
  await note.locator("button:not([data-testid])").last().click();
  await expect(page.getByTestId("write-inline-note")).toHaveCount(0);

  // The rail (right panel) now has exactly one fewer row …
  await expect(railRows(page)).toHaveCount(rowsBefore - 1);
  // … the resolved conflict's row is gone from the panel …
  await expect(railRows(page).filter({ hasText: target })).toHaveCount(0);
  // … and no OTHER row was removed: the remaining set is the old set minus target.
  const quotesAfter = await railRows(page).allInnerTexts();
  const expectedRemaining = quotesBefore.filter((t) => !t.includes(target));
  expect(quotesAfter.sort()).toEqual(expectedRemaining.sort());
});

// RIGHT PANEL empty-state — resolving EVERY outstanding mark clears the rail to
// its "Nothing outstanding" state (no orphan rows left in the right panel).
test("write conflict: clearing every mark empties the right panel to its all-clear state", async ({
  page,
}) => {
  // Resolve marks one at a time until the rail is empty. Each 'leave' persists,
  // so re-reading the live first row each loop avoids stale-handle churn.
  for (let guard = 0; guard < 12; guard++) {
    const remaining = await railRows(page).count();
    if (remaining === 0) break;
    await railRows(page).first().click();
    const openNote = page.getByTestId("write-inline-note");
    await expect(openNote).toBeVisible();
    // Every mark offers a final "leave"/dismiss action as its last button.
    await openNote.locator("button:not([data-testid])").last().click();
    await expect(page.getByTestId("write-inline-note")).toHaveCount(0);
    // The panel shrank by one on this iteration.
    await expect(railRows(page)).toHaveCount(remaining - 1);
  }

  // The right panel is now empty and shows its all-clear copy.
  await expect(railRows(page)).toHaveCount(0);
  await expect(
    page.locator(RAIL).getByText(/nothing outstanding/i),
  ).toBeVisible();
});
