import { test, expect, type Page, type Locator } from "@playwright/test";
import { reseed } from "../_helpers/seed";

// ===========================================================================
// Group 2.5 — The full authoring journey (RED-first, DRIVES the build).
//
// One continuous user story, the way a writer actually works, from an empty
// book to a deleted chapter:
//
//   create a book  ->  rename its chapter from the SIDEBAR
//                  ->  rename its chapter from the MAIN heading  (RED today)
//                  ->  write prose in the main body
//                  ->  edit that prose in the main body
//                  ->  create a second chapter, then delete chapters.
//
// The MAIN-heading rename is the reported gap: the sidebar title is
// click-to-edit (WriteIndex/EditableTitle) but the manuscript <h1> is a plain,
// non-editable heading (Manuscript.tsx). This spec is RED on that step until the
// main heading becomes click-to-edit like the sidebar. The other steps lock the
// journey so a future edit can't silently break create/write/edit/delete.
//
// State-mutating (creates a throwaway book + chapters, renames, deletes), so it
// reseeds after itself to leave the shared DB pristine for later-sorting specs.
// It NEVER touches the seeded book.
// ===========================================================================

test.afterEach(reseed);

// --- selectors --------------------------------------------------------------

const CHAPTERS_NAV = 'nav[aria-label="Chapters"]';
const BOOK_TRIGGER = 'button[aria-haspopup="menu"]';
const BOOK_MENU = '[role="menu"][aria-label="Switch book"]';

function chaptersNav(page: Page): Locator {
  return page.locator(CHAPTERS_NAV);
}

/**
 * The chapter-select rows. Selected STRUCTURALLY (each row is
 * `li > div > button:first-child`) rather than by negating the control buttons'
 * text: the per-row rename/delete affordances are icon buttons with no text at
 * all, so a `hasNotText` filter would silently count them as chapters.
 */
function chapterRows(page: Page): Locator {
  return chaptersNav(page).locator("ul > li > div > button:first-child");
}

/** The ACTIVE chapter row (the button carries aria-current="true"). */
function activeRow(page: Page): Locator {
  return chaptersNav(page).locator('button[aria-current="true"]').first();
}

/** The main manuscript heading (the middle-of-screen title the writer sees). */
function mainTitle(page: Page): Locator {
  return page.locator("h1").first();
}

/** The ProseMirror editor body (the main writing surface). */
function editor(page: Page): Locator {
  return page.locator(".ProseMirror").first();
}

async function expandChapters(page: Page): Promise<void> {
  const toggle = chaptersNav(page).locator("button[aria-expanded]").first();
  if (
    (await toggle.count()) &&
    (await toggle.getAttribute("aria-expanded")) !== "true"
  ) {
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

function throwawayName(): string {
  return `__e2e_journey_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

// --- book helpers (grounded in shell/BookPill.tsx) --------------------------

function bookTrigger(page: Page): Locator {
  return page.locator(BOOK_TRIGGER).first();
}
function bookMenu(page: Page): Locator {
  return page.locator(BOOK_MENU);
}
async function openBookMenu(page: Page): Promise<void> {
  const trigger = bookTrigger(page);
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await expect(bookMenu(page)).toBeVisible();
}
async function createBook(page: Page, name: string): Promise<void> {
  await openBookMenu(page);
  await bookMenu(page).getByRole("menuitem", { name: /\+ New book/ }).click();
  const input = page.getByRole("textbox", { name: /name the new book/i });
  await expect(input).toBeVisible();
  await input.fill(name);
  await page.getByRole("button", { name: /^Create$/ }).click();
  await expect(bookTrigger(page)).toContainText(name, { timeout: 10_000 });
}
async function deleteActiveBook(page: Page, name: string): Promise<void> {
  await openBookMenu(page);
  await bookMenu(page).getByRole("menuitem", { name: /Delete book/ }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  const confirm = modal.getByRole("button", { name: /^Delete \d+ rows$/ });
  await modal.getByRole("textbox").last().fill(name);
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

// ===========================================================================
// 2.5a — Rename the chapter title from the MAIN heading (RED today).
//
// Isolated from the long journey so the reported bug is a single, unambiguous
// RED signal (the long journey below also exercises it, in context).
// ===========================================================================
test.describe("2.5 authoring journey", () => {
  test("the MAIN manuscript title is click-to-edit and renames the chapter (RED-first)", async ({
    page,
  }) => {
    await gotoWrite(page);
    const heading = mainTitle(page);
    await expect(heading).toBeVisible();
    const original = (await heading.innerText()).trim();

    // TARGET UX: clicking the middle-of-screen title makes it editable, exactly
    // like the sidebar title. Today it is a plain <h1> → RED until built.
    await heading.click();
    const editable = page
      .locator("h1[contenteditable], h1 [contenteditable]")
      .first();
    await expect(
      editable,
      "the main heading is inline-editable on click (RED until the main-title rename is built)",
    ).toBeVisible();

    const renamed = `${original} (main-renamed)`;
    await editable.click();
    await editable.press("Control+a");
    await page.keyboard.type(renamed);
    await page.keyboard.press("Enter");

    // The rename PERSISTS: the sidebar active row and the main heading both show
    // the new title after the server round-trips it.
    await expect(mainTitle(page)).toContainText("(main-renamed)");
    await expect(activeRow(page)).toContainText("(main-renamed)");

    // And it survives a reload (it is a real DB write, not client-only state).
    await page.reload();
    await expect(mainTitle(page)).toContainText("(main-renamed)");
  });

  // =========================================================================
  // 2.5b — The full story end to end, in one flow.
  // =========================================================================
  test("create book -> edit title (sidebar + main) -> write + edit body -> delete chapters", async ({
    page,
  }) => {
    const bookName = throwawayName();
    await gotoWrite(page);
    try {
      // 1) CREATE a book (auto-seeds a real Chapter One).
      await createBook(page, bookName);
      await expandChapters(page);
      await expect(chapterRows(page)).toHaveCount(1);
      await expect(chapterRows(page).first()).toContainText(/Chapter One/i);

      // 2) EDIT the title from the SIDEBAR (existing affordance).
      const sidebarTitle = activeRow(page)
        .locator(".write-chapter-title, [contenteditable]")
        .first();
      await sidebarTitle.click();
      await sidebarTitle.press("Control+a");
      await page.keyboard.type("Sidebar Named");
      await page.keyboard.press("Enter");
      await expect(activeRow(page)).toContainText("Sidebar Named");
      // The main heading follows the same source of truth.
      await expect(mainTitle(page)).toContainText("Sidebar Named");

      // 3) EDIT the title from the MAIN heading (the reported gap → RED here).
      const heading = mainTitle(page);
      await heading.click();
      const mainEditable = page
        .locator("h1[contenteditable], h1 [contenteditable]")
        .first();
      await expect(
        mainEditable,
        "the main heading is click-to-edit (RED until built)",
      ).toBeVisible();
      await mainEditable.click();
      await mainEditable.press("Control+a");
      await page.keyboard.type("Main Named");
      await page.keyboard.press("Enter");
      await expect(mainTitle(page)).toContainText("Main Named");
      await expect(activeRow(page)).toContainText("Main Named");

      // 4) WRITE prose in the MAIN body.
      const body = editor(page);
      await body.click();
      await page.keyboard.type("The tide came in before the oath was spoken.");
      await expect(body).toContainText("before the oath was spoken");

      // 5) EDIT that prose in the MAIN body (append to what was written).
      await body.click();
      await page.keyboard.press("End");
      await page.keyboard.type(" Then the water withdrew.");
      await expect(body).toContainText("Then the water withdrew");

      // 6) CREATE a second chapter, then DELETE it via the sidebar confirm.
      await chaptersNav(page)
        .getByRole("button", { name: /\+ New chapter/ })
        .click();
      await expect(chapterRows(page)).toHaveCount(2);

      // The per-row delete is an icon button, so its accessible name comes
      // entirely from its aria-label ("Delete chapter N: Title").
      const del = chaptersNav(page)
        .getByRole("button", { name: /^Delete chapter \d+/ })
        .first();
      await expect(del).toBeEnabled();
      await del.click();
      // The confirm dialog's primary action is the "Delete chapter" button.
      const confirm = page
        .getByRole("dialog")
        .getByRole("button", { name: /^Delete chapter$/ });
      await expect(confirm).toBeVisible();
      await confirm.click();
      await expect(chapterRows(page)).toHaveCount(1);

      // 7) The last remaining chapter cannot be deleted (invariant holds).
      await expect(
        chaptersNav(page).getByRole("button", { name: /^Delete chapter \d+/ }),
      ).toBeDisabled();
    } finally {
      // Clean up the throwaway book (cascades its chapters).
      await deleteActiveBook(page, bookName).catch(() => {});
    }
  });
});
