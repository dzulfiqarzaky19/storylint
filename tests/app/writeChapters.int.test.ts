import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { closePool } from "@/lib/db/pool";
import { listChapters, getBook } from "@/lib/db/queries";
import { insertBook, renameBook } from "@/lib/db/mutations";
import { deleteBookCascade } from "@/lib/db/mutations";

// -----------------------------------------------------------------------------
// T-SCOPE-2 (INTEGRATION, real Postgres). The load-bearing fix: listChapters is
// SCOPED to a book, so the /write left index shows exactly the active book's
// chapters instead of colliding all 42 across six books (six "CHAPTER ONE").
//
// MUTATION-LOCK: seed is 6 books, 2-per-world x 3 worlds, 7 chapters each = 42.
// listChapters(book-1) MUST return exactly 7 (book I's chapters) and MUST NOT
// return 42. If the WHERE book_id = $1 predicate is dropped (the mutant), every
// book's Chapter 1..7 collides and the count jumps 7 -> 42, so the assertions
// below go RED for the exact reason.
//
// SHARED-DB HYGIENE: read-only against the seed for the filter proof; the
// renameBook case operates on its OWN throwaway book and deletes it in the same
// test so it never touches a seeded book.
// -----------------------------------------------------------------------------

loadEnv();

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterAll(async () => {
  await closePool();
});

describe("listChapters book_id filter (T-SCOPE-2 mutation-lock)", () => {
  it("returns exactly the ACTIVE book's 7 chapters, never all 42", async () => {
    const book1 = await listChapters("book-1");
    // The seed gives each book 7 chapters (Chapter 1..7). The unfiltered bug
    // returned all 42 across six books; the scoped query returns exactly 7.
    expect(book1).toHaveLength(7);
    expect(book1.length).not.toBe(42);
    // Numbers restart at 1 within the book (UNIQUE(book_id, number)).
    expect(book1.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns a DIFFERENT sibling book's own 7 chapters (not book I's)", async () => {
    const book2 = await listChapters("book-2");
    expect(book2).toHaveLength(7);
    // book-2 is ASHKELD BOOK II in the same world; its chapter ids are distinct
    // from book-1's even though the numbers 1..7 repeat.
    const book1Ids = new Set((await listChapters("book-1")).map((c) => c.id));
    expect(book2.every((c) => !book1Ids.has(c.id))).toBe(true);
  });

  it("returns an EMPTY list for a book with no chapters (never the global 42)", async () => {
    // A freshly minted book has zero chapters. The un-filtered bug would return
    // all 42 here; the scoped query returns [].
    const id = `test-scope2-${randomUUID()}`;
    await insertBook({ id, name: "Throwaway", worldId: "world-universe-1" });
    try {
      const chapters = await listChapters(id);
      expect(chapters).toHaveLength(0);
    } finally {
      await deleteBookCascade(id);
    }
  });
});

describe("renameBook (T-SCOPE-2 book dropdown Rename)", () => {
  it("renames a book in place and a blank rename is a no-op", async () => {
    const id = `test-scope2-${randomUUID()}`;
    await insertBook({ id, name: "Before", worldId: "world-universe-1" });
    try {
      await renameBook({ id, name: "After" });
      expect((await getBook(id))?.title).toBe("After");
      // Blank/whitespace rename must NOT blank the name (belt-and-suspenders).
      await renameBook({ id, name: "   " });
      expect((await getBook(id))?.title).toBe("After");
    } finally {
      await deleteBookCascade(id);
    }
  });
});
