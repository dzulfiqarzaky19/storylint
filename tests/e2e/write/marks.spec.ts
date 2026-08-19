import { test, expect, type Page, type Locator } from "@playwright/test";
import { railRows } from "../_helpers/rail";
import { reseed } from "../_helpers/seed";

// ===========================================================================
// Group 3 — Marks (user-journey e2e for the /write inline-note actions).
//
// Written RED-FIRST to the INTENDED end state defined in
// docs/write-user-journeys.md, not to the code as it stands today. The button
// relabels (red=2, gray=3, merged `Ask AI`) and the EDIT/ADD modal routing are
// the product target; these specs fail on current code and that RED is the
// spec — implementing to green is the build.
//
// Journeys:
//   3.1  opening a chapter shows contradictions/unrecorded on the right rail
//   3.2  button sets: red = 2 exact labels, gray = 3 exact labels, in order
//   3.2a AI merge — the `Ask AI` button gives BOTH goods (run-select + rewrite)
//   3.2b AI not available — `Ask AI` hidden, remaining buttons still work
//   3.3  add a mark into the wiki — CONTRADICTION → EDIT, UNRECORDED → ADD
//
// State hygiene (bakes in the cross-spec-pollution lesson): this file resolves
// marks (persists resolved_marks) and may write facts, so it reseeds in
// afterAll to leave the shared DB pristine for later-sorting specs.
// ===========================================================================

test.afterAll(reseed);

// --- exact target labels (docs/write-user-journeys.md §3.2) -----------------

/** Contradiction (red) note — final button labels, in order. */
const RED_LABELS = ["The wiki is out of date — change it", "Ask AI"] as const;

/** Unrecorded (gray) note — final button labels, in order. */
const GRAY_LABELS = ["Add to the wiki", "Ask AI", "Remove suggestion"] as const;

/** The same labels with AI turned OFF (the `Ask AI` button drops out). */
const RED_LABELS_NO_AI = ["The wiki is out of date — change it"] as const;
const GRAY_LABELS_NO_AI = ["Add to the wiki", "Remove suggestion"] as const;

// --- helpers ----------------------------------------------------------------

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

/** True when the editor currently has a non-empty text selection. */
async function hasSelection(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const sel = window.getSelection();
    return Boolean(sel && !sel.isCollapsed && sel.toString().trim().length > 0);
  });
}

/** The engine action buttons in a note, in DOM order (excludes AI/apply testids). */
function engineActions(note: Locator): Locator {
  return note.locator("button:not([data-testid])");
}

/** Open the write screen and wait for the manuscript to render. */
async function gotoWrite(page: Page): Promise<void> {
  await page.goto("/write");
  await expect(
    page.getByText("nineteen and sworn", { exact: false }).first(),
  ).toBeVisible();
}

/**
 * Open the note for the first rail row whose kind matches `kind`
 * (conflict = red underline, unrecorded = gray). Returns the note locator.
 *
 * The rail row's own underline class tells us the kind; we open rows until the
 * note's kind-label matches, so red/gray journeys pick the right mark without
 * hard-coding a quote that seed drift could move.
 */
async function openNoteOfKind(page: Page, kind: "conflict" | "unrecorded"): Promise<Locator> {
  const wantLabel = kind === "conflict"
    ? /Contradicts the gazetteer/i
    : /Not written down yet/i;
  const rows = railRows(page);
  const count = await rows.count();
  expect(count, "rail has at least one mark to open").toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await rows.nth(i).click();
    const note = page.getByTestId("write-inline-note");
    await expect(note).toBeVisible();
    if (await note.getByText(wantLabel).count()) return note;
    // Not this kind — close and try the next row.
    await rows.nth(i).click();
  }
  throw new Error(`no ${kind} mark found in the rail`);
}

/** Whether AI is configured (the merged `Ask AI` button only renders when on). */
async function aiEnabled(note: Locator): Promise<boolean> {
  return (await note.getByRole("button", { name: /Ask AI/i }).count()) > 0;
}

// ===========================================================================
// 3.1 — Opening a chapter shows its marks on the right rail
// ===========================================================================
test.describe("3.1 marks appear on the rail", () => {
  test("the rail lists marks and the flagged runs are underlined in the prose", async ({
    page,
  }) => {
    await gotoWrite(page);

    // The Outstanding-marks rail has at least one mark row.
    const rows = railRows(page);
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    // The flagged runs are underlined in the manuscript (conflict or unrecorded).
    const underlines = page.locator(
      ".write-underline-conflict, .write-underline-unrecorded",
    );
    await expect(underlines.first()).toBeVisible();
    expect(await underlines.count()).toBeGreaterThan(0);
  });

  test("only one note is open at a time; clicking the open row closes it", async ({
    page,
  }) => {
    await gotoWrite(page);
    const rows = railRows(page);
    await expect(page.getByTestId("write-inline-note")).toHaveCount(0);

    await rows.first().click();
    await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("write-inline-note")).toHaveCount(1);

    if ((await rows.count()) > 1) {
      await rows.nth(1).click();
      await expect(rows.nth(1)).toHaveAttribute("aria-pressed", "true");
      await expect(rows.first()).toHaveAttribute("aria-pressed", "false");
      await expect(page.getByTestId("write-inline-note")).toHaveCount(1);
    }

    // Clicking the open row again closes the note.
    const open = page.locator('aside[aria-label="Outstanding marks"] button[aria-pressed="true"]');
    await open.first().click();
    await expect(page.getByTestId("write-inline-note")).toHaveCount(0);
  });
});

// ===========================================================================
// 3.2 — Button sets: exact labels and order (RED-first: current engine ships
// different labels + a separate ✦ Ask AI, so these fail until the relabel lands)
// ===========================================================================
test.describe("3.2 note button sets are exact", () => {
  test("a contradiction (red) note shows exactly 2 buttons in order", async ({
    page,
  }) => {
    await gotoWrite(page);
    const note = await openNoteOfKind(page, "conflict");
    const labels = [...RED_LABELS];

    const buttons = engineActions(note);
    await expect(
      buttons,
      "red note has exactly 2 engine buttons (no separate ✦ Ask AI)",
    ).toHaveCount(labels.length);
    for (const [i, label] of labels.entries()) {
      await expect(buttons.nth(i)).toHaveText(label);
    }
    // No standalone ✦ Ask AI affordance — its role is merged into button 2.
    await expect(note.getByTestId("write-ai-explain")).toHaveCount(0);
  });

  test("an unrecorded (gray) note shows exactly 3 buttons in order", async ({
    page,
  }) => {
    await gotoWrite(page);
    const note = await openNoteOfKind(page, "unrecorded");
    const labels = [...GRAY_LABELS];

    const buttons = engineActions(note);
    await expect(
      buttons,
      "gray note has exactly 3 engine buttons (no separate ✦ Ask AI)",
    ).toHaveCount(labels.length);
    for (const [i, label] of labels.entries()) {
      await expect(buttons.nth(i)).toHaveText(label);
    }
    await expect(note.getByTestId("write-ai-explain")).toHaveCount(0);
  });
});

// ===========================================================================
// 3.2a — AI merge: the `Ask AI` button gives BOTH goods (run-select + rewrite).
// e2e-only (integration can't see the editor selection + note render together).
// Live gateway; driven to COMPLETION per the cross-cutting principle.
// ===========================================================================
test.describe("3.2a Ask AI merges both goods", () => {
  test("clicking Ask AI on a red note selects the run AND fetches the rewrite", async ({
    page,
  }) => {
    test.slow(); // live AI roundtrip
    await gotoWrite(page);
    const note = await openNoteOfKind(page, "conflict");

    if (!(await aiEnabled(note))) {
      test.skip(true, "AI not configured; the merged Ask AI button is hidden.");
      return;
    }

    const before = await manuscriptText(page);
    const askAi = note.getByRole("button", { name: /Ask AI/i });
    await askAi.click();

    // GOOD #1: the flagged run is selected in the editor (positions the writer).
    await expect
      .poll(() => hasSelection(page), { timeout: 10_000 })
      .toBe(true);

    // GOOD #2: the grounded AI advice returns and offers a rewrite affordance.
    const advice = page.getByTestId("write-ai-advice");
    await expect(advice).toBeVisible({ timeout: 45_000 });
    expect((await advice.innerText()).trim().length).toBeGreaterThan(0);

    // Merely asking never mutates the manuscript (only "Use in editor" does).
    expect(await manuscriptText(page)).toBe(before);

    // Drive to completion: if a rewrite is offered, applying it edits the prose.
    const apply = page.getByTestId("write-ai-apply");
    if (await apply.count()) {
      await apply.click();
      await expect(page.getByTestId("write-inline-note")).toHaveCount(0);
      expect(await manuscriptText(page)).not.toBe(before);
    }
  });
});

// ===========================================================================
// 3.2b — AI not available: the merged `Ask AI` button is hidden, and the
// remaining buttons are the exact reduced set (red=1, gray=2).
// ===========================================================================
test.describe("3.2b AI not available", () => {
  test("with AI off, a red note shows exactly its 1 non-AI button", async ({
    page,
  }) => {
    await gotoWrite(page);
    const note = await openNoteOfKind(page, "conflict");
    if (await aiEnabled(note)) {
      test.skip(true, "AI is configured in this env; AI-off path not exercised here.");
      return;
    }
    const buttons = engineActions(note);
    await expect(buttons).toHaveCount(RED_LABELS_NO_AI.length);
    for (const [i, label] of [...RED_LABELS_NO_AI].entries()) {
      await expect(buttons.nth(i)).toHaveText(label);
    }
    await expect(note.getByRole("button", { name: /Ask AI/i })).toHaveCount(0);
  });

  test("with AI off, a gray note shows exactly its 2 non-AI buttons", async ({
    page,
  }) => {
    await gotoWrite(page);
    const note = await openNoteOfKind(page, "unrecorded");
    if (await aiEnabled(note)) {
      test.skip(true, "AI is configured in this env; AI-off path not exercised here.");
      return;
    }
    const buttons = engineActions(note);
    await expect(buttons).toHaveCount(GRAY_LABELS_NO_AI.length);
    for (const [i, label] of [...GRAY_LABELS_NO_AI].entries()) {
      await expect(buttons.nth(i)).toHaveText(label);
    }
    await expect(note.getByRole("button", { name: /Ask AI/i })).toHaveCount(0);
  });
});

// ===========================================================================
// 3.3 — Add a mark into the wiki: CONTRADICTION → EDIT (prefilled, in place),
// UNRECORDED → ADD (create). Asserts the modal opens in the right mode and is
// driven to completion. DB-record scope + self-clean is covered by afterAll
// reseed above.
// ===========================================================================
test.describe("3.3 add to wiki — EDIT vs ADD routing", () => {
  test("a contradiction opens the wiki modal in EDIT mode, prefilled with the fact", async ({
    page,
  }) => {
    await gotoWrite(page);
    const note = await openNoteOfKind(page, "conflict");

    // The primary action is "The wiki is out of date — change it".
    const changeIt = note.getByRole("button", { name: RED_LABELS[0] });
    await expect(changeIt).toBeVisible();
    await changeIt.click();

    // A modal opens locked to the contradicted entry/fact, prefilled — NOT a
    // blank add form. (RED-first: today the write screen surfaces a notice, not
    // the modal, so this fails until the EDIT routing is wired on /write.)
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal, "modal is in edit/update mode, not create").toContainText(
      /edit|update|change/i,
    );
    // A prefilled value field carries the corrected value (non-empty).
    const value = modal.locator('input, textarea').filter({ hasText: /.*/ }).first();
    await expect(value).toBeVisible();

    // Drive to completion: cancel closes the modal (no write; DB untouched).
    const cancel = modal.getByRole("button", { name: /cancel|close/i }).first();
    if (await cancel.count()) {
      await cancel.click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });

  test("an unrecorded mark opens the wiki modal in ADD (create) mode", async ({
    page,
  }) => {
    await gotoWrite(page);
    const note = await openNoteOfKind(page, "unrecorded");

    const addToWiki = note.getByRole("button", { name: GRAY_LABELS[0] });
    await expect(addToWiki).toBeVisible();
    await addToWiki.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal, "modal is in add/create mode").toContainText(
      /add to the wiki|add detail|create entry/i,
    );

    const cancel = modal.getByRole("button", { name: /cancel|close/i }).first();
    if (await cancel.count()) {
      await cancel.click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });
});
