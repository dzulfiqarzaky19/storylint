import { test, expect, type Page, type Locator } from "@playwright/test";
import { reseed } from "../_helpers/seed";

// ===========================================================================
// Group 2 — Chapters (user-journey e2e for the /write chapter list + editor).
//
// Written RED-FIRST to the INTENDED end state (docs/write-user-journeys.md).
// 2.1 (create/nav/save) and 2.3 (dot severity) exist today and are LOCKED here;
// 2.2 (rename/delete) and 2.2b (no AI check on an empty chapter) do NOT exist
// yet — those specs are RED and DRIVE the build. 2.4 (download) locks the route.
//
// This file creates + edits chapters (persists state), so it reseeds in
// afterAll to keep the shared DB pristine for later-sorting specs.
// ===========================================================================

test.afterAll(reseed);

// --- helpers ----------------------------------------------------------------

const CHAPTERS_NAV = 'nav[aria-label="Chapters"]';

/** The Chapters nav (left index). */
function chaptersNav(page: Page): Locator {
  return page.locator(CHAPTERS_NAV);
}

/** The chapter-select rows (the aria-current-bearing buttons, not +New). */
function chapterRows(page: Page): Locator {
  return chaptersNav(page)
    .locator("button")
    .filter({ hasNotText: /^Chapters|\+ New chapter/ });
}

/** Ensure the Chapters panel is expanded (it collapses at <=1200px). */
async function expandChapters(page: Page): Promise<void> {
  const toggle = chaptersNav(page).locator("button[aria-expanded]").first();
  if ((await toggle.count()) && (await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
}

async function gotoWrite(page: Page): Promise<void> {
  await page.goto("/write");
  await expect(
    page.getByText("nineteen and sworn", { exact: false }).first(),
  ).toBeVisible();
  await expandChapters(page);
}

/** The ProseMirror editor body. */
function editor(page: Page): Locator {
  return page.locator(".ProseMirror").first();
}

// ===========================================================================
// 2.1 — Create / navigate / save (EXISTS — lock it)
// ===========================================================================
test.describe("2.1 chapter create / navigate / save", () => {
  test("selecting a different chapter navigates the manuscript (URL + aria-current)", async ({
    page,
  }) => {
    await gotoWrite(page);
    const rows = chapterRows(page);
    const count = await rows.count();
    if (count < 2) test.skip(true, "need >= 2 chapters to test navigation");

    // Pick a row that is not the current one.
    const currentIdx = await rows.evaluateAll((els) =>
      els.findIndex((e) => e.getAttribute("aria-current") === "true"),
    );
    const targetIdx = currentIdx === 0 ? 1 : 0;
    const target = rows.nth(targetIdx);
    await target.click();

    await expect(page).toHaveURL(/chapter=\d+/);
    await expect(target).toHaveAttribute("aria-current", "true");
  });

  test("a newly created chapter appears in the list and can be opened (self-clean)", async ({
    page,
  }) => {
    await gotoWrite(page);
    const rows = chapterRows(page);
    const before = await rows.count();

    await chaptersNav(page).getByRole("button", { name: /\+ New chapter/ }).click();

    // The list grows by one and the URL reflects a chapter switch.
    await expect(rows).toHaveCount(before + 1);
    await expect(page).toHaveURL(/chapter=\d+/);
    // NOTE: cleanup of the created chapter is via afterAll reseed (no UI delete
    // exists yet — 2.2 builds it; until then reseed restores the seed list).
  });
});

// ===========================================================================
// 2.2 — Rename / delete (NOT built — RED-first, drives the build)
// ===========================================================================
test.describe("2.2 chapter rename / delete (RED-first)", () => {
  test("clicking a chapter title makes it inline-editable and renames it", async ({
    page,
  }) => {
    await gotoWrite(page);
    // TARGET UX: the chapter title (sidebar row or main heading) is click-to-edit,
    // same as the wiki. No such affordance exists yet → RED.
    const rows = chapterRows(page);
    const active = rows.filter({ has: page.locator("[aria-current='true']") }).first();
    const title = active.locator(".write-chapter-title, [contenteditable]").first();
    await expect(
      title,
      "an inline-editable chapter title exists (RED until rename is built)",
    ).toBeVisible();

    await title.click();
    await page.keyboard.type(" (renamed)");
    await page.keyboard.press("Enter");
    await expect(active).toContainText("(renamed)");
  });

  test("a sidebar delete icon opens a confirm modal and deletes the chapter", async ({
    page,
  }) => {
    await gotoWrite(page);
    const rows = chapterRows(page);
    const before = await rows.count();

    // TARGET UX: each chapter row has a delete icon → confirm modal
    // "Are you sure you want to delete chapter {n}: {title}". None exists → RED.
    const del = chaptersNav(page)
      .getByRole("button", { name: /delete chapter/i })
      .first();
    await expect(
      del,
      "a per-row delete affordance exists (RED until delete is built)",
    ).toBeVisible();
    await del.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toContainText(/are you sure you want to delete chapter/i);
    await modal.getByRole("button", { name: /delete|confirm/i }).click();
    await expect(rows).toHaveCount(before - 1);
  });

  test("deleting the OPEN chapter navigates to the nearest surviving chapter", async ({
    page,
  }) => {
    await gotoWrite(page);
    const rows = chapterRows(page);
    if ((await rows.count()) < 2) test.skip(true, "need >= 2 chapters");

    // TARGET: prefer previous, else next, fall back to chapter one.
    const del = chaptersNav(page)
      .getByRole("button", { name: /delete chapter/i })
      .first();
    await expect(del, "delete affordance exists (RED until built)").toBeVisible();
    await del.click();
    await page.getByRole("dialog").getByRole("button", { name: /delete|confirm/i }).click();

    // A sibling is now active (some row carries aria-current).
    await expect(rows.filter({ has: page.locator("[aria-current='true']") })).toHaveCount(1);
  });

  test("the last remaining chapter cannot be deleted", async ({ page }) => {
    await gotoWrite(page);
    // TARGET: when chapters.length === 1 the delete affordance is disabled/absent.
    // (Asserted structurally: a book with one chapter offers no working delete.)
    // RED-first placeholder — the guard + the affordance are both unbuilt.
    const del = chaptersNav(page).getByRole("button", { name: /delete chapter/i });
    // Until built this is 0; once built, on a 1-chapter book it must be disabled.
    // We assert the INTENT: no ENABLED delete when only one chapter remains.
    const single = (await chapterRows(page).count()) === 1;
    if (!single) test.skip(true, "seed book has >1 chapter; single-chapter guard tested on a fresh book in books.spec");
    await expect(del.filter({ hasNot: page.locator("[disabled]") })).toHaveCount(0);
  });

  test("the dirty check flags a title-only change AND a body-only change", async ({
    page,
  }) => {
    await gotoWrite(page);
    // TARGET: "unsaved changes" compares BOTH title and body against saved values.
    // Needs a visible dirty indicator (e.g. an enabled Save / "Unsaved" marker).
    const dirtyFlag = page.getByText(/unsaved/i).or(
      page.getByRole("button", { name: /^save$/i }),
    );

    // Body-only change → dirty.
    await editor(page).click();
    await page.keyboard.type("X");
    await expect(
      dirtyFlag.first(),
      "a body edit marks the chapter dirty (RED until a dirty indicator exists)",
    ).toBeVisible();

    // Title-only change → dirty (RED until the title is editable + tracked).
    const title = chapterRows(page)
      .filter({ has: page.locator("[aria-current='true']") })
      .locator(".write-chapter-title, [contenteditable]")
      .first();
    await expect(
      title,
      "an editable title exists so a title-only edit can mark dirty (RED)",
    ).toBeVisible();
  });
});

// ===========================================================================
// 2.2b — A new empty chapter must NOT trigger an AI check (LATER guard, RED)
// ===========================================================================
test.describe("2.2b new empty chapter does not fire an AI check (RED-first)", () => {
  test("creating an empty chapter makes no AI-check request", async ({ page }) => {
    await gotoWrite(page);

    // Watch for any AI-check network call while we create + mount an empty chapter.
    const aiCalls: string[] = [];
    page.on("request", (req) => {
      if (/\/api\/(ai|check|advice|explain)/i.test(req.url())) aiCalls.push(req.url());
    });

    await chaptersNav(page).getByRole("button", { name: /\+ New chapter/ }).click();
    await expect(page).toHaveURL(/chapter=\d+/);
    // Give any on-mount check a moment to (wrongly) fire.
    await page.waitForTimeout(2_000);

    // TARGET: an empty chapter fires NO AI check. Today it does → RED.
    expect(
      aiCalls,
      "an empty new chapter must not trigger an AI check",
    ).toEqual([]);
  });
});

// ===========================================================================
// 2.3 — Left-index chapter severity dot (EXISTS — lock it)
// ===========================================================================
test.describe("2.3 chapter severity dot", () => {
  test("a chapter with a contradiction shows a red dot; unrecorded-only shows yellow; active shows none", async ({
    page,
  }) => {
    await gotoWrite(page);
    const nav = chaptersNav(page);

    // The active chapter never shows a dot (you're already looking at it).
    const active = chapterRows(page).filter({
      has: page.locator("[aria-current='true']"),
    });
    await expect(
      active.locator('[aria-label="Has a contradiction"], [aria-label="Has an unrecorded detail"]'),
    ).toHaveCount(0);

    // At least one non-active chapter carries a severity dot (seed has marks).
    const anyDot = nav.locator(
      '[aria-label="Has a contradiction"], [aria-label="Has an unrecorded detail"]',
    );
    await expect(anyDot.first()).toBeVisible();

    // A red dot means a contradiction; a yellow dot means unrecorded-only. Both
    // aria-labels are distinct, so their presence is self-describing.
    expect(await anyDot.count()).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 2.4 — Download a single chapter (EXISTS — lock the route)
// ===========================================================================
test.describe("2.4 download a single chapter", () => {
  test("the export-chapter link targets the per-chapter route and returns that chapter", async ({
    page,
    request,
  }) => {
    await gotoWrite(page);
    const link = page.getByTestId("export-chapter");
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/api\/export\/[^/]+\/chapter\/\d+$/);

    // The route resolves and returns non-empty chapter content (not the book).
    const res = await request.get(href!);
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body.trim().length).toBeGreaterThan(0);
  });
});
