import { test, expect, type Page } from "@playwright/test";
import { railRows } from "./_helpers/rail";

// Exhaustive WRITE-screen click-through (per-screen e2e). Drives every
// interactive control on /write at the canonical 1440x900 frame and asserts the
// flow. Product rule 1 is sacred: the inline note's "wiki" action must NEVER
// silently write the wiki — on the write screen it surfaces the "send it to the
// wiki thread" notice and closes the note (the Wiki screen owns confirmation).
//
// Live AI-call assertions (Ask AI / Use in editor) live in ai.spec.ts and are
// NOT duplicated here — this spec covers the engine/nav affordances. It shares
// ai.spec.ts's note-portal gotcha: the note is portalled INTO .ProseMirror, so
// manuscript text is read from top-level <p> runs only.

/** The manuscript prose only (excludes the portalled inline note text). */
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

function chapters(page: Page) {
  return page.locator('nav[aria-label="Chapters"]');
}

test.beforeEach(async ({ page }) => {
  await page.goto("/write");
  await expect(
    page.getByText("nineteen and sworn", { exact: false }).first(),
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// Engine ran: underline decorations render; the promise block is present.
// ---------------------------------------------------------------------------
test("write: the engine underlines runs and the promise block is pinned", async ({
  page,
}) => {
  const underlines = page.locator(
    ".write-underline-conflict, .write-underline-unrecorded",
  );
  await expect(underlines.first()).toBeVisible();
  expect(await underlines.count()).toBeGreaterThan(0);
  await expect(
    page.getByText("Nothing enters the gazetteer until you write it in.", {
      exact: false,
    }),
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// Chapters index: rail toggle, chapter select (navigates), create chapter.
// ---------------------------------------------------------------------------
test("write chapters: the Chapters rail toggles open and closed", async ({
  page,
}) => {
  const nav = chapters(page);
  await expect(nav).toBeVisible();
  const toggle = nav.locator("button[aria-expanded]").first();
  const initial = (await toggle.getAttribute("aria-expanded")) ?? "false";
  await toggle.click();
  await expect(toggle).not.toHaveAttribute("aria-expanded", initial);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", initial);
});

test("write chapters: selecting a different chapter navigates the manuscript", async ({
  page,
}) => {
  const nav = chapters(page);
  const toggle = nav.locator("button[aria-expanded]").first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  // Chapter rows are the non-toggle, non-create buttons.
  const rows = nav
    .locator("button")
    .filter({ hasNotText: /^Chapters|\+ New chapter/ });
  const count = await rows.count();
  if (count < 2) test.skip(true, "need >=2 chapters to test navigation");

  // Pick a chapter that is NOT the current one (default is chapter 7 / last).
  const current = rows.locator("[aria-current='true']");
  const targetIdx = (await current.count()) && (await rows.first().getAttribute("aria-current")) === "true" ? 1 : 0;
  const target = rows.nth(targetIdx);
  const label = (await target.textContent())?.trim() ?? "";
  await target.click();
  // URL reflects the chapter switch (?chapter=N).
  await expect(page).toHaveURL(/chapter=\d+/);
  await expect(target).toHaveAttribute("aria-current", "true");
  expect(label.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Rail row select == open note; only ONE open at a time; row highlights.
// ---------------------------------------------------------------------------
test("write rail: clicking a row opens exactly one note and highlights the row", async ({
  page,
}) => {
  const rows = railRows(page);
  await expect(rows.first()).toBeVisible();
  await expect(page.getByTestId("write-inline-note")).toHaveCount(0);

  await rows.first().click();
  await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
  const note = page.getByTestId("write-inline-note");
  await expect(note).toHaveCount(1);
  await expect(note).toBeVisible();

  if ((await rows.count()) > 1) {
    await rows.nth(1).click();
    await expect(rows.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(rows.first()).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("write-inline-note")).toHaveCount(1);
  }
});

test("write rail: clicking the open row again closes the note", async ({
  page,
}) => {
  const rows = railRows(page);
  await rows.first().click();
  await expect(page.getByTestId("write-inline-note")).toHaveCount(1);
  await rows.first().click();
  await expect(rows.first()).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("write-inline-note")).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Inline note actions: the note offers >=3 differentiated engine actions.
// ---------------------------------------------------------------------------
test("write note: opens with at least three differentiated engine actions", async ({
  page,
}) => {
  await railRows(page).first().click();
  const note = page.getByTestId("write-inline-note");
  await expect(note).toBeVisible();
  // Engine actions are the non-AI buttons (exclude the ✦ AI affordance).
  const actionButtons = note.locator("button:not([data-testid])");
  expect(await actionButtons.count()).toBeGreaterThanOrEqual(3);
});

// ---------------------------------------------------------------------------
// Rule 1: the note's "wiki" action does NOT write the wiki from the write
// screen — it surfaces the "send it to the wiki thread" notice and closes the
// note. The manuscript is unchanged and no confirmation strip appears here.
// ---------------------------------------------------------------------------
test("write note: the wiki action surfaces the confirmation notice, never a silent write", async ({
  page,
}) => {
  await railRows(page).first().click();
  const note = page.getByTestId("write-inline-note");
  await expect(note).toBeVisible();
  const before = await manuscriptText(page);

  // The primary action on a contradiction/missing mark is the wiki/add action.
  const primary = note.locator("button:not([data-testid])").first();
  const label = (await primary.textContent())?.trim() ?? "";
  await primary.click();

  // The note closes and the gazetteer-promise notice is surfaced (role=alert).
  await expect(page.getByTestId("write-inline-note")).toHaveCount(0);
  await expect(
    page.getByText(/nothing enters the gazetteer without a yes/i),
  ).toBeVisible();

  // Manuscript body is unchanged, and no research-style confirmation strip
  // exists on this screen.
  const after = await manuscriptText(page);
  expect(after).toBe(before);
  await expect(page.getByText("Yes, write it in", { exact: false })).toHaveCount(0);
  expect(label.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Rule 1 companion: the AI affordance, when present, is additive — the note's
// engine actions remain. (Live call covered in ai.spec.ts.)
// ---------------------------------------------------------------------------
test("write note: when AI is on the ✦ affordance is additive to engine actions", async ({
  page,
}) => {
  await railRows(page).first().click();
  const note = page.getByTestId("write-inline-note");
  await expect(note).toBeVisible();
  const explain = note.getByTestId("write-ai-explain");
  if ((await explain.count()) === 0) test.skip(true, "AI disabled — no ✦ affordance");
  await expect(explain).toContainText(/Ask AI/i);
  // Engine actions still present alongside AI.
  expect(await note.locator("button:not([data-testid])").count()).toBeGreaterThanOrEqual(3);
});

// ---------------------------------------------------------------------------
// Responsive rail: >1200px always-open (no toggle); <=1200px collapsible.
// ---------------------------------------------------------------------------
test("write rail: responsive — always open at 1440, collapsible below 1200", async ({
  page,
}) => {
  const promise = page.getByText(
    "Nothing enters the gazetteer until you write it in.",
    { exact: false },
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("button", { name: /two signals/i })).toBeHidden();
  await expect(promise).toBeVisible();

  await page.setViewportSize({ width: 1100, height: 900 });
  const toggle = page.getByRole("button", { name: /two signals/i });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(promise).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(promise).toBeVisible();
  await toggle.click();
  await expect(promise).toBeHidden();
});
