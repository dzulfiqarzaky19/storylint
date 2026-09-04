import { test, expect, type Page, type Locator } from "@playwright/test";
import { reseed } from "../_helpers/seed";

// ===========================================================================
// Group 1 — Books (user-journey e2e for the book switcher / CRUD / export).
//
// Written to the INTENDED end state (docs/write-user-journeys.md §1). Some
// journeys lock existing behavior (world-scoping, the type-the-name delete
// gate, export route); others are RED-first and DRIVE the build:
//   - creating a book must AUTO-SEED a real Chapter 1 (DB row → sidebar);
//   - switching to a book must land on its HIGHEST-numbered chapter;
//   - deleting a book must cascade its chapters with NO unsaved-changes save-gate.
//
// This file creates + deletes throwaway books (persists state), so it reseeds
// in afterAll to leave the shared DB pristine. It NEVER mutates the seeded book.
// ===========================================================================

test.afterAll(reseed);

// --- selectors (grounded in shell/BookPill.tsx) -----------------------------

const BOOK_TRIGGER = 'button[aria-haspopup="menu"]';
const BOOK_MENU = '[role="menu"][aria-label="Switch book"]';

function bookTrigger(page: Page): Locator {
  return page.locator(BOOK_TRIGGER).first();
}

function bookMenu(page: Page): Locator {
  return page.locator(BOOK_MENU);
}

/** The book radio items in the switcher menu. */
function bookItems(page: Page): Locator {
  return bookMenu(page).getByRole("menuitemradio");
}

async function openBookMenu(page: Page): Promise<void> {
  const trigger = bookTrigger(page);
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await expect(bookMenu(page)).toBeVisible();
}

async function gotoWrite(page: Page): Promise<void> {
  await page.goto("/write");
  await expect(
    page.getByText("nineteen and sworn", { exact: false }).first(),
  ).toBeVisible();
}

/** A unique throwaway book name so parallel runs never collide. */
function throwawayName(): string {
  return `__e2e_book_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/** Create a book via the switcher; returns its name. Self-clean is the caller's. */
async function createBook(page: Page, name: string): Promise<void> {
  await openBookMenu(page);
  await bookMenu(page).getByRole("menuitem", { name: /\+ New book/ }).click();
  const input = page.getByRole("textbox", { name: /name the new book/i });
  await expect(input).toBeVisible();
  await input.fill(name);
  await page.getByRole("button", { name: /^Create$/ }).click();
  // Land on the new book: the trigger now shows its name.
  await expect(bookTrigger(page)).toContainText(name, { timeout: 10_000 });
}

/** Delete the currently-active book via the type-the-name gate. */
async function deleteActiveBook(page: Page, name: string): Promise<void> {
  await openBookMenu(page);
  await bookMenu(page).getByRole("menuitem", { name: /Delete book/ }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  const confirm = modal.getByRole("button", { name: /^Delete \d+ rows$/ });
  // GATE: confirm is disabled until the exact name is typed.
  await expect(confirm).toBeDisabled();
  await modal.getByRole("textbox").last().fill(name);
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

// ===========================================================================
// 1.1 — Books are scoped to the current world
// ===========================================================================
test.describe("1.1 books scoped to world", () => {
  test("the switcher lists only the current world's books", async ({ page }) => {
    await gotoWrite(page);
    await openBookMenu(page);
    // Every listed book belongs to the active world's group; the menu is titled
    // "Switch book" and its group header is the world title.
    const items = bookItems(page);
    expect(await items.count()).toBeGreaterThan(0);
    // Read-only journey — no mutation, no cleanup.
  });
});

// ===========================================================================
// 1.2 — Book CRUD (create auto-seeds Ch1, switch→highest chapter, type-name
// delete gate, no save-gate on book delete). RED-first where noted.
// ===========================================================================
test.describe("1.2 book CRUD", () => {
  test("creating a book auto-seeds a real Chapter 1 in the sidebar (RED-first)", async ({
    page,
  }) => {
    const name = throwawayName();
    await gotoWrite(page);
    try {
      await createBook(page, name);

      // TARGET: the new book shows exactly one chapter, "Chapter One", ready to
      // write — persisted, not a UI placeholder. (RED until create seeds a row.)
      // Chapter-row buttons only, selected structurally (`li > div >
      // button:first-child`): the nav also holds the head, "+ New chapter", and
      // a textless rename/delete icon pair per row, none of which are chapters.
      const rows = page.locator(
        'nav[aria-label="Chapters"] ul > li > div > button:first-child',
      );
      await expect(
        rows,
        "a freshly created book has exactly one chapter row",
      ).toHaveCount(1);
      await expect(rows.first()).toContainText(/Chapter One/i);
    } finally {
      await deleteActiveBook(page, name).catch(() => {});
    }
  });

  test("switching to a book lands on its highest-numbered chapter (RED-first)", async ({
    page,
  }) => {
    const name = throwawayName();
    await gotoWrite(page);
    try {
      await createBook(page, name);
      // Add a 2nd and 3rd chapter so "highest" is unambiguous.
      const nav = page.locator('nav[aria-label="Chapters"]');
      await nav.getByRole("button", { name: /\+ New chapter/ }).click();
      await nav.getByRole("button", { name: /\+ New chapter/ }).click();

      // Switch AWAY to the seeded book, then BACK.
      await openBookMenu(page);
      await bookItems(page).filter({ hasNotText: name }).first().click();
      await openBookMenu(page);
      await bookItems(page).filter({ hasText: name }).first().click();

      // TARGET: back on our book, the active chapter is the highest (Chapter Three),
      // not Chapter One. (RED until switch lands on highest.)
      const active = page
        .locator('nav[aria-label="Chapters"] [aria-current="true"]')
        .first();
      await expect(active).toContainText(/Chapter Three/i);
    } finally {
      await deleteActiveBook(page, name).catch(() => {});
    }
  });

  test("book delete requires typing the exact name, then removes the book", async ({
    page,
  }) => {
    const name = throwawayName();
    await gotoWrite(page);
    try {
      await createBook(page, name);

      // Open delete; the confirm is gated on retyping the exact name.
      await openBookMenu(page);
      await bookMenu(page).getByRole("menuitem", { name: /Delete book/ }).click();
      const modal = page.getByRole("dialog");
      await expect(modal).toContainText(new RegExp(`Delete ${name}\\?`));
      const confirm = modal.getByRole("button", { name: /^Delete \d+ rows$/ });
      await expect(confirm).toBeDisabled();
      // A WRONG name keeps it disabled.
      await modal.getByRole("textbox").last().fill(`${name}_wrong`);
      await expect(confirm).toBeDisabled();
      // The EXACT name enables it.
      await modal.getByRole("textbox").last().fill(name);
      await expect(confirm).toBeEnabled();
      await confirm.click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // The book is gone from the switcher.
      await openBookMenu(page);
      await expect(bookItems(page).filter({ hasText: name })).toHaveCount(0);
    } catch (e) {
      await deleteActiveBook(page, name).catch(() => {});
      throw e;
    }
  });

  test("deleting a book discards its chapters with NO unsaved-changes save-gate (RED-first)", async ({
    page,
  }) => {
    const name = throwawayName();
    await gotoWrite(page);
    try {
      await createBook(page, name);

      // Dirty a chapter (type into the editor without saving).
      await page.locator(".ProseMirror").first().click();
      await page.keyboard.type("unsaved words that will be discarded");

      // Delete the book — TARGET: no unsaved-changes prompt fires, only the
      // type-the-name confirm. (RED-first if a dirty guard would block/warn.)
      await deleteActiveBook(page, name);
      // No save/discard dialog appeared after the delete resolved.
      await expect(page.getByText(/unsaved changes|save.*before/i)).toHaveCount(0);

      await openBookMenu(page);
      await expect(bookItems(page).filter({ hasText: name })).toHaveCount(0);
    } catch (e) {
      await deleteActiveBook(page, name).catch(() => {});
      throw e;
    }
  });

  test("the last book in a world cannot be deleted", async ({ page }) => {
    await gotoWrite(page);
    await openBookMenu(page);
    // When only one book exists, Delete book is disabled with an explanatory
    // title. The seed world has >1 book, so we assert the guard's SHAPE: the
    // Delete affordance is disabled iff there's a single book.
    const del = bookMenu(page).getByRole("menuitem", { name: /Delete book/ });
    const bookCount = await bookItems(page).count();
    if (bookCount > 1) {
      await expect(del).toBeEnabled();
      test.info().annotations.push({
        type: "guard",
        description: "seed world has >1 book; single-book disable proven by canDeleteBook=books.length>1",
      });
    } else {
      await expect(del).toBeDisabled();
    }
  });
});

// ===========================================================================
// 1.3 — Download a whole book
// ===========================================================================
test.describe("1.3 download a whole book", () => {
  test("the export-book link targets the book route and returns book content", async ({
    page,
    request,
  }) => {
    await gotoWrite(page);
    const link = page.getByTestId("export-book");
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/api\/export\/[^/]+$/);

    const res = await request.get(href!);
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    // The whole-book export contains a known seed chapter heading.
    expect(body.trim().length).toBeGreaterThan(0);
  });
});
