import { test, expect, type Page, type Locator } from "@playwright/test";
import { execFileSync } from "node:child_process";

// -----------------------------------------------------------------------------
// WRITE — CONFLICT PATH (integration). The seeded Chapter 7 emits TWO conflict
// marks ("nineteen and sworn", "Her own grey eyes"). write-lifecycle.spec.ts
// dismisses whichever mark is first, and `leave` now PERSISTS to resolved_marks
// (survives reload), so a spec that pins a SPECIFIC conflict cannot rely on the
// shared DB being pristine. This file reseeds ONCE in beforeAll so it starts
// from the canonical 4-mark state no matter what else has run.
//
//   • the contradiction note is in the gazetteer voice and offers exactly the
//     three conflict actions in order (wiki / change-the-sentence / leave);
//   • PRODUCT RULE 1: "The wiki is out of date" NEVER writes the wiki — it
//     surfaces the gazetteer notice, closes the note, and leaves the mark
//     outstanding, with the manuscript prose untouched;
//   • "It's deliberate, leave it" drops THAT contradiction specifically and no
//     other.
//
// Gotchas (shared with write-lifecycle.spec.ts): the inline note is portalled
// INTO .ProseMirror; rail rows are scoped to the Outstanding-marks aside; only
// trusted (Playwright) clicks flip real toggles.
// -----------------------------------------------------------------------------

const RAIL = 'aside[aria-label="Outstanding marks"]';

// db:seed TRUNCATEs resolved_marks + dismissed_suggestions (runtime state), so
// this restores the canonical 4-mark Chapter 7 without a full schema reset.
test.beforeAll(() => {
  execFileSync("npm", ["run", "db:seed"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
});

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

/** Rail rows are the mark buttons inside the Outstanding-marks aside only. */
function railRows(page: Page): Locator {
  return page.locator(`${RAIL} button[aria-pressed]`);
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

test.beforeEach(async ({ page }) => {
  await page.goto("/write");
  // The seeded Chapter 7 renders and the engine has produced its conflict marks.
  await expect(
    railRows(page).filter({ hasText: "Her own grey eyes" }),
  ).toHaveCount(1);
});

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
// NOTE: this test persists a resolution to resolved_marks; beforeAll reseeds the
// file, so ordering within the file still leaves the other tests a clean start
// on the next full run.
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
