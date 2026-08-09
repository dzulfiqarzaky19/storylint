import { test, expect, type Page, type Locator } from "@playwright/test";
import { railRows, pressedRows } from "./_helpers/rail";

// -----------------------------------------------------------------------------
// WRITE mark LIFECYCLE (integration). Complements write.spec.ts (affordance
// click-through) and ai.spec.ts (live AI) by driving the mark's full DOM
// lifecycle end to end against the real seeded manuscript + check engine:
//
//   • "leave"/"not now"  → the row AND its underline clear immediately (not on
//     the next check pass), the open note closes, and the mark count drops by
//     exactly one. (The reducer guarantee is unit-locked in
//     tests/state/writeReducerMarks.test.ts; this proves the wired DOM.)
//   • rail row ⇄ underline are the SAME open trigger and share a stable
//     data-mark-key, so a row and its underline resolve to one mark.
//   • "change the sentence" (conflict middle action) keeps the note OPEN and
//     never writes the wiki (product rule 1).
//   • the editor autosave indicator settles to "Saved".
//
// Gotchas honoured (per the write.spec header + coordinator handoff):
//   • the inline note is portalled INTO .ProseMirror, so manuscript prose is
//     read from top-level <p> runs only (manuscriptText()).
//   • rail rows are scoped INSIDE the Outstanding-marks aside — other screens'
//     Keep/tile buttons also use aria-pressed, and so does the note-less rail.
//   • synthetic .click() does not flip real toggles; Playwright issues trusted
//     clicks, which is what we use throughout.
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

/** Underline decorations carry a stable data-mark-key (== the mark's key). */
function underlines(page: Page): Locator {
  return page.locator(".ProseMirror [data-mark-key]");
}

/**
 * The set of mark keys currently underlined in the manuscript. The engine may
 * render the same mark as multiple inline decoration spans (across text nodes),
 * so we dedupe by key — this is the count that matters for "a mark cleared".
 */
async function underlinedKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const keys = new Set<string>();
    document
      .querySelectorAll(".ProseMirror [data-mark-key]")
      .forEach((el) => {
        const k = el.getAttribute("data-mark-key");
        if (k) keys.add(k);
      });
    return Array.from(keys);
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/write");
  // The real seeded chapter renders (shared assertion with the other specs).
  await expect(
    page.getByText("nineteen and sworn", { exact: false }).first(),
  ).toBeVisible();
  // The engine has run: at least one underline is present.
  await expect(underlines(page).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// The rail and the underlines describe the SAME set of marks: every rail row's
// quote is underlined, and the deduped underline-key count matches the row
// count. This is the invariant the rest of the lifecycle leans on.
// ---------------------------------------------------------------------------
test("write lifecycle: rail rows and underlines describe the same marks", async ({
  page,
}) => {
  const rows = railRows(page);
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);

  const keys = await underlinedKeys(page);
  // Every outstanding mark in the rail has a corresponding underline.
  expect(keys.length).toBe(rowCount);

  // Opening a row underlines/opens exactly that mark (one note at a time).
  await rows.first().click();
  await expect(page.getByTestId("write-inline-note")).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
});

// ---------------------------------------------------------------------------
// Clicking an UNDERLINE opens the note — the same trigger as a rail row. The
// two share data-mark-key, so the row that highlights is the underline's mark.
// ---------------------------------------------------------------------------
test("write lifecycle: clicking an underline opens the note (same trigger as the rail)", async ({
  page,
}) => {
  await expect(page.getByTestId("write-inline-note")).toHaveCount(0);
  const firstUnderline = underlines(page).first();
  const key = await firstUnderline.getAttribute("data-mark-key");
  expect(key).toBeTruthy();

  await firstUnderline.click();
  const note = page.getByTestId("write-inline-note");
  await expect(note).toHaveCount(1);
  await expect(note).toBeVisible();

  // The rail row for that same key is now pressed (rail ⇄ underline are one).
  const pressed = pressedRows(page);
  await expect(pressed).toHaveCount(1);
});

// ---------------------------------------------------------------------------
// LIFECYCLE — "leave"/"not now" resolves a mark: the note closes, the rail row
// disappears, the mark's underline (by data-mark-key) clears immediately, and
// the total mark count drops by exactly one. (Reducer unit test locks the
// pure-state guarantee; this proves the full wiring in a real browser.)
// ---------------------------------------------------------------------------
test("write lifecycle: 'leave'/'not now' clears the row and the underline immediately", async ({
  page,
}) => {
  const rows = railRows(page);
  const before = await rows.count();
  expect(before).toBeGreaterThan(0);

  // Open the first mark and capture its key from the highlighted underline.
  await rows.first().click();
  const note = page.getByTestId("write-inline-note");
  await expect(note).toBeVisible();
  const openKey = await pressedRows(page)
    .getAttribute("data-mark-key")
    .catch(() => null);
  // The rail button itself may not carry the key; derive it from the note's
  // paragraph underline instead if needed.
  const keysBefore = await underlinedKeys(page);
  expect(keysBefore.length).toBe(before);

  // The LAST action is always the dismiss action: "It's deliberate, leave it"
  // (conflict) or "Not now" (missing). Both map to the reducer's 'leave'.
  const actions = note.locator("button:not([data-testid])");
  const dismiss = actions.last();
  const dismissLabel = (await dismiss.textContent())?.trim() ?? "";
  expect(dismissLabel.length).toBeGreaterThan(0);
  await dismiss.click();

  // The note closes …
  await expect(page.getByTestId("write-inline-note")).toHaveCount(0);
  // … a row is gone (count drops by exactly one) …
  await expect(railRows(page)).toHaveCount(before - 1);
  // … and the underline set shrinks by exactly one deduped key.
  const keysAfter = await underlinedKeys(page);
  expect(keysAfter.length).toBe(before - 1);

  // The specific dismissed key (if we captured one) is gone from the underlines.
  if (openKey) expect(keysAfter).not.toContain(openKey);
  // In any case, exactly one key left the set and none were added.
  const removed = keysBefore.filter((k) => !keysAfter.includes(k));
  const added = keysAfter.filter((k) => !keysBefore.includes(k));
  expect(removed.length).toBe(1);
  expect(added.length).toBe(0);
});

// ---------------------------------------------------------------------------
// A dismissed mark must not resurface. After a 'leave', reopening the remaining
// rows and re-reading the underline set shows the dismissed key stays gone (the
// reducer's SET_MARKS re-emit guard, observed through the DOM).
// ---------------------------------------------------------------------------
test("write lifecycle: a dismissed mark does not resurface after further interaction", async ({
  page,
}) => {
  const rows = railRows(page);
  const before = await rows.count();
  test.skip(before < 2, "needs >=2 marks to interact after dismissing one");

  const keysBefore = await underlinedKeys(page);
  await rows.first().click();
  const note = page.getByTestId("write-inline-note");
  await note.locator("button:not([data-testid])").last().click();
  await expect(page.getByTestId("write-inline-note")).toHaveCount(0);

  const keysAfter = await underlinedKeys(page);
  const removed = keysBefore.filter((k) => !keysAfter.includes(k))[0];
  expect(removed).toBeTruthy();

  // Poke the remaining rows (open/close) — a re-check must not revive `removed`.
  const remaining = railRows(page);
  await remaining.first().click();
  await expect(page.getByTestId("write-inline-note")).toBeVisible();
  await remaining.first().click(); // close
  await expect(page.getByTestId("write-inline-note")).toHaveCount(0);

  const keysFinal = await underlinedKeys(page);
  expect(keysFinal).not.toContain(removed);
  expect(keysFinal.length).toBe(before - 1);
});

// ---------------------------------------------------------------------------
// RULE 1 companion — the "text" resolution (a contradiction's "Change the
// sentence", or a missing mark's "Add, but let me word it") puts the writer in
// the run and KEEPS the note open (so an AI rewrite / "Use in editor" stays
// reachable). It must never write the wiki nor spawn a confirmation strip, and
// it must NOT drop the mark (that is dismissal's job). With AI off it is a pure
// caret move; the manuscript prose is unchanged.
//
// resolutionIdOf maps BOTH the conflict middle action ('text') and the missing
// middle action ('edit') to the reducer's 'text' path, so we drive whichever
// mark kind the seed presents. The seeded chapter currently yields an
// UNRECORDED mark → middle action "Add, but let me word it".
// ---------------------------------------------------------------------------
test("write lifecycle: the 'reword it myself' action keeps the note open and never writes the wiki", async ({
  page,
}) => {
  const rows = railRows(page);
  await rows.first().click();
  const note = page.getByTestId("write-inline-note");
  await expect(note).toBeVisible();

  const before = await manuscriptText(page);
  const rowsBefore = await railRows(page).count();

  // Middle action is the text/reword resolution for either mark kind:
  //   conflict → "Change the sentence"  (id 'text')
  //   missing  → "Add, but let me word it" (id 'edit' → 'text')
  const actions = note.locator("button:not([data-testid])");
  const middle = actions.nth(1);
  const middleLabel = (await middle.textContent())?.trim() ?? "";
  expect(middleLabel).toMatch(/change the sentence|let me word it/i);
  await middle.click();

  // The note STAYS open (unlike leave/wiki, which close it) …
  await expect(page.getByTestId("write-inline-note")).toHaveCount(1);
  // … no wiki confirmation strip appears (product rule 1) …
  await expect(
    page.getByText("Yes, write it in", { exact: false }),
  ).toHaveCount(0);
  // … the mark is NOT dropped (a text resolution is not a dismissal) …
  await expect(railRows(page)).toHaveCount(rowsBefore);
  // … and with AI off the manuscript prose is unchanged (caret-only). When AI
  // is on a rewrite is only *offered*, applied via "Use in editor"
  // (ai.spec.ts owns the applied path), so the prose is still unchanged here.
  const after = await manuscriptText(page);
  expect(after).toBe(before);
});

// ---------------------------------------------------------------------------
// Editor autosave indicator: the manuscript shows a role=status save state that
// settles to "Saved" (seeded, clean load). This is the load-bearing signal that
// the editor is wired to the save pipeline.
// ---------------------------------------------------------------------------
test("write lifecycle: the manuscript save indicator settles to 'Saved'", async ({
  page,
}) => {
  const status = page.locator('p[role="status"]');
  await expect(status).toBeVisible();
  // On a clean seeded load the document is not dirty → "Saved".
  await expect(status).toHaveText(/saved/i);
});
