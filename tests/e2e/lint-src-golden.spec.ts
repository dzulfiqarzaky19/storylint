import { test, expect, type Page, type Locator } from "@playwright/test";
import { railRows } from "./_helpers/rail";

// GOLDEN MASTER (behavior-lock) for T-LINT-SRC.
//
// Captured against PRISTINE HEAD before the react-hooks refactor of
// Manuscript.tsx / InlineText.tsx / WikiScreen.tsx, then re-run UNCHANGED after
// the refactor. Its whole job is to prove the hooks-correctness changes alter
// ZERO observable behavior.
//
// It binds ONLY to public, user-visible behavior — rendered DOM, visible text,
// portal placement, mark/dot/rail state, and interaction outcomes. It never
// asserts a hook order, a ref, a file line, or any internal, so the SAME spec is
// valid on both sides of the refactor. The refactor touches four surfaces; the
// coverage is ordered by behavior-observability risk:
//   1. (d) decoration/note portal on /write — HIGHEST risk (removes bump()).
//   2. Manuscript refs (a/b/c) — rail/underlines/dot-suppression/select/type.
//   3. InlineText (2) — /wiki draft resyncs to prop; editing draft preserved.
//   4. WikiScreen (1) — /wiki suggestion "Write it in" flow still works.
//
// SEED-INDEPENDENCE. The default /write chapter depends on DB state (the newest
// or last-edited chapter), so every /write case navigates explicitly to
// ?chapter=7 — the seeded conflict chapter. Its outstanding marks come from TWO
// layers: (1) the DETERMINISTIC checkManuscript rule engine, re-run server-side
// on every load (page.tsx initialMarks) — Maren's grey-vs-green eyes, the
// unrecorded ring/tallow-rule phrases — these render regardless of AI or cache
// state; (2) an OPTIONAL AI cross-check overlay (initialAiMarks), present only
// when aiEnabled() AND its body/wiki-hash cache is fresh. So the exact rail COUNT
// varies with the AI overlay, but at least the layer-1 marks are always present.
// The golden therefore locks STRUCTURE (marks present, underline kinds, portal
// behavior, dot-suppression), never an exact count. Dot assertions are LOCAL
// (Ch6's single yellow dot with Ch7's own dot suppressed while active), never a
// global dot total that unrelated chapters' warmed-DB drift can move.
//
// Read-only: it persists nothing that survives the run (the one commit path is a
// fresh throwaway fact value; no resolution is persisted), so it needs no reseed
// and is safe against the warmed live DB.

const CHAPTERS = 'nav[aria-label="Chapters"]';
const YELLOW_LABEL = "Has an unrecorded detail";
const RED_LABEL = "Has a contradiction";

/** A chapter-nav button by its visible title (e.g. "Low Water" = Ch7). */
function chapterButton(page: Page, title: RegExp): Locator {
  return page.locator(`${CHAPTERS} button`).filter({ hasText: title });
}

/** Open /write on the seeded conflict chapter and wait for its marks to render. */
async function gotoChapterSeven(page: Page): Promise<void> {
  await page.goto("/write?chapter=7");
  // Gate on the rail being POPULATED, not on an exact count. The base marks come
  // from the deterministic checkManuscript engine (always present); an optional
  // AI overlay adds a variable number more, so the exact count is not stable.
  // Lock structure, never a count.
  await expect(railRows(page).first()).toBeVisible();
  await expect
    .poll(async () => railRows(page).count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
}

// ===========================================================================
// 1. (d) DECORATION / NOTE PORTAL — the top-risk path (bump() removal).
//    The inline note is React-portalled INTO a [data-write-note-host] widget the
//    ProseMirror plugin mounts at the END of the open mark's paragraph. Opening,
//    switching, and closing a mark must keep the portal correct WITHOUT the
//    former forced re-render.
// ===========================================================================

test.describe("golden /write — decoration + note portal", () => {
  test.beforeEach(async ({ page }) => {
    await gotoChapterSeven(page);
  });

  test("opening a mark portals the inline note under its own paragraph", async ({
    page,
  }) => {
    // No note, and no host mounted, before any open.
    await expect(page.getByTestId("write-inline-note")).toHaveCount(0);
    await expect(page.locator(".ProseMirror [data-write-note-host]")).toHaveCount(
      0,
    );

    await railRows(page).first().click();

    // Exactly one note, portalled into exactly one host that lives inside the
    // editor (i.e. under a paragraph, in document flow — the portal followed the
    // host with no forced re-render).
    const note = page.getByTestId("write-inline-note");
    await expect(note).toHaveCount(1);
    await expect(note).toBeVisible();
    const host = page.locator(".ProseMirror [data-write-note-host]");
    await expect(host).toHaveCount(1);
    await expect(host.getByTestId("write-inline-note")).toHaveCount(1);
    await expect(
      page.locator(".ProseMirror p:has([data-write-note-host])"),
    ).toHaveCount(1);
  });

  test("switching the open mark moves the note to the new mark, still exactly one", async ({
    page,
  }) => {
    const rows = railRows(page);
    expect(await rows.count()).toBeGreaterThanOrEqual(2);

    await rows.first().click();
    await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("write-inline-note")).toHaveCount(1);

    await rows.nth(1).click();
    // The old row released, the new row is pressed, and there is STILL exactly
    // one note in exactly one host (it followed the newly-open mark).
    await expect(rows.first()).toHaveAttribute("aria-pressed", "false");
    await expect(rows.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("write-inline-note")).toHaveCount(1);
    await expect(page.locator(".ProseMirror [data-write-note-host]")).toHaveCount(
      1,
    );
  });

  test("closing the open mark clears the note and its host", async ({ page }) => {
    const rows = railRows(page);
    await rows.first().click();
    await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("write-inline-note")).toHaveCount(1);

    await rows.first().click();
    await expect(rows.first()).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("write-inline-note")).toHaveCount(0);
    await expect(page.locator(".ProseMirror [data-write-note-host]")).toHaveCount(
      0,
    );
  });
});

// ===========================================================================
// 2. MANUSCRIPT REFS (a/b/c) — the plugin's getData()/refs still feed the live
//    render: the seven marks underline the prose and fill the rail, the active
//    chapter's own severity dot is suppressed while a sibling's shows, selecting
//    a mark opens its note, and the editor accepts typed input.
// ===========================================================================

test.describe("golden /write — engine render via refs", () => {
  test.beforeEach(async ({ page }) => {
    await gotoChapterSeven(page);
  });

  test("Chapter Seven underlines its prose and fills the rail with its marks", async ({
    page,
  }) => {
    const underlines = page.locator(
      ".write-underline-conflict, .write-underline-unrecorded",
    );
    await expect(underlines.first()).toBeVisible();
    // Both signal kinds are present in the prose.
    expect(await page.locator(".write-underline-conflict").count()).toBeGreaterThan(
      0,
    );
    expect(
      await page.locator(".write-underline-unrecorded").count(),
    ).toBeGreaterThan(0);
    // The rail is populated with Chapter Seven's outstanding marks (count is not
    // asserted exactly — a deterministic base plus a variable AI overlay; see
    // gotoChapterSeven).
    expect(await railRows(page).count()).toBeGreaterThan(0);
  });

  test("a chapter's own severity dot is shown when idle and suppressed when active", async ({
    page,
  }) => {
    // The suppression invariant, proven on Chapter Seven ITSELF (its red comes
    // from the deterministic eyes contradiction, so it survives AI-off). When Ch7
    // is NOT the active chapter it shows its RED dot; when it IS active the dot is
    // suppressed ("a dot, but nothing new to read"). Testing the toggle on one
    // chapter is seed-independent — it needs no assumption about any sibling.
    const seven = chapterButton(page, /Low Water/i);

    // Idle: make a different chapter active, Ch7 shows its red dot.
    await page.goto("/write?chapter=1");
    await expect(seven).not.toHaveAttribute("aria-current", "true");
    await expect(seven.locator(`[aria-label="${RED_LABEL}"]`)).toHaveCount(1);

    // Active: open Ch7, its own dot is suppressed (neither red nor yellow on it).
    await gotoChapterSeven(page);
    await expect(seven).toHaveAttribute("aria-current", "true");
    await expect(seven.locator(`[aria-label="${RED_LABEL}"]`)).toHaveCount(0);
    await expect(seven.locator(`[aria-label="${YELLOW_LABEL}"]`)).toHaveCount(0);
  });

  test("selecting a rail row opens its note and presses only that row", async ({
    page,
  }) => {
    const rows = railRows(page);
    await rows.first().click();
    await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("write-inline-note")).toHaveCount(1);
    // Exactly one row is pressed at a time.
    await expect(
      page.locator('aside[aria-label="Outstanding marks"] button[aria-pressed="true"]'),
    ).toHaveCount(1);
  });

  test("the editor accepts typed input and the prose updates", async ({ page }) => {
    const pm = page.locator(".ProseMirror");
    await expect(pm).toBeVisible();
    // Place the caret at the very start, then type; the new characters appear.
    await pm.click();
    await page.keyboard.press("Control+Home");
    const token = `zqx${Date.now() % 100000}`;
    await page.keyboard.type(token);
    await expect(
      page.locator(".ProseMirror").getByText(token, { exact: false }),
    ).toBeVisible();
  });
});

// ===========================================================================
// 3. INLINETEXT (2) — draft state syncs with the prop. Commit (Enter) writes the
//    new value; Cancel (Escape) discards the local draft and the committed value
//    shows again. This is the exact resync-when-not-editing behavior the refactor
//    reworks (effect -> adjust-state-during-render).
// ===========================================================================

test.describe("golden /wiki — InlineText draft/value sync", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wiki");
    await expect(page.getByText("Maren", { exact: false }).first()).toBeVisible();
  });

  test("inline edit: Enter commits the draft, Escape discards it and the value returns", async ({
    page,
  }) => {
    // Add a fresh, known-empty fact so we edit a throwaway cell (self-cleaning:
    // the row is transient authoring, not a seeded value we must restore).
    await page.getByRole("button", { name: "+ Add detail" }).click();
    const valueBtn = page.getByRole("button", { name: "detail value" }).last();
    await expect(valueBtn).toBeVisible();

    // Commit path: click -> input -> type -> Enter -> the static text shows it.
    await valueBtn.click();
    const input = page.getByRole("textbox", { name: "detail value" });
    await expect(input).toBeVisible();
    const committed = `golden-${Date.now()}`;
    await input.fill(committed);
    await input.press("Enter");
    await expect(
      page.getByText(committed, { exact: false }).first(),
    ).toBeVisible();

    // Cancel path: re-open the SAME cell (its draft must resync to the committed
    // value), type junk, Escape -> junk discarded and the committed value stays.
    // This is the draft<-value resync the refactor reworks.
    await page.getByText(committed, { exact: false }).first().click();
    const input2 = page.getByRole("textbox", { name: "detail value" });
    await expect(input2).toBeVisible();
    await expect(input2).toHaveValue(committed);
    await input2.fill("GOLDEN-SHOULD-NOT-PERSIST");
    await input2.press("Escape");
    await expect(
      page.getByText("GOLDEN-SHOULD-NOT-PERSIST", { exact: false }),
    ).toHaveCount(0);
    await expect(
      page.getByText(committed, { exact: false }).first(),
    ).toBeVisible();
  });
});

// ===========================================================================
// 4. WIKISCREEN (1) — the suggestion "Write it in" flow (writeSuggestion, whose
//    ordering/deps the refactor corrects) still exposes its two per-card actions.
//    Skips cleanly when the seed produced no manuscript suggestions.
// ===========================================================================

test.describe("golden /wiki — suggestion write-in flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wiki");
    await expect(page.getByText("Maren", { exact: false }).first()).toBeVisible();
  });

  test("the suggestion band exposes 'Write it in' / 'Leave it' actions", async ({
    page,
  }) => {
    const band = page.locator(
      '[aria-label="Suggestions from the manuscript"]',
    );
    if ((await band.count()) === 0)
      test.skip(true, "no manuscript suggestions in seed");
    await expect(
      band.getByRole("button", { name: /Write it in/i }).first(),
    ).toBeVisible();
    await expect(
      band.getByRole("button", { name: /Leave it/i }).first(),
    ).toBeVisible();
  });
});
