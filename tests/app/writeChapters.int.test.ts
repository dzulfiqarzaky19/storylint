import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { closePool } from "@/lib/db/pool";
import { listChapters, getBook } from "@/lib/db/queries";
import { insertBook, insertChapter, renameBook } from "@/lib/db/mutations";
import { deleteBookCascade } from "@/lib/db/mutations";
import { DEFAULT_BOOK_ID, DEFAULT_WORLD_ID } from "@/lib/db/scope";
import { loadBook } from "@/lib/novel/loadBook";

// The default book (MoL) backs the app scope; chapter count is DERIVED from its
// loaded source so a reseed tracks it.
const MOL = loadBook("mother-of-learning");

// -----------------------------------------------------------------------------
// T-SCOPE-2 (INTEGRATION, real Postgres). The load-bearing fix: listChapters is
// SCOPED to a book, so the /write left index shows exactly the active book's
// chapters instead of colliding every book's chapters into one list.
//
// MUTATION-LOCK: the seed is one book (book-mol-1) with MOL_CHAPTERS.length
// chapters. listChapters(book-mol-1) MUST return exactly that many, and a book
// with no chapters MUST return []. If the WHERE book_id = $1 predicate is dropped
// (the mutant), a sibling book's chapters leak into the count, so the isolation
// assertion below goes RED for the exact reason. Expectations are DERIVED from the
// seed source (MOL_CHAPTERS) so a reseed tracks them.
//
// SHARED-DB HYGIENE: read-only against the seed for the filter proof; the sibling
// and rename cases operate on their OWN throwaway books and delete them in the
// same test so they never touch the seeded book.
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
  it("returns exactly the ACTIVE book's chapters, never the global set", async () => {
    const book1 = await listChapters(DEFAULT_BOOK_ID);
    // The seed gives book-mol-1 exactly MOL_CHAPTERS.length chapters. The
    // unfiltered bug returned every book's chapters; the scoped query returns
    // only this book's. Count is derived from the seed source.
    expect(book1).toHaveLength(MOL.chapters.length);
    // Numbers restart at 1 within the book (UNIQUE(book_id, number)).
    expect(book1.map((c) => c.number)).toEqual(
      MOL.chapters.map((_c, i) => i + 1),
    );
  });

  it("returns a DIFFERENT sibling book's own chapters (not book-mol-1's)", async () => {
    // Mint a throwaway SIBLING book under the same world with its own single
    // chapter numbered 1. Its chapter id is distinct from every book-mol-1
    // chapter, so a book-scoped query never leaks one into the other.
    const siblingId = `test-scope2-${randomUUID()}`;
    const chapId = `test-scope2-ch-${randomUUID()}`;
    await insertBook({ id: siblingId, name: "Sibling", worldId: DEFAULT_WORLD_ID });
    await insertChapter({ id: chapId, number: 1, title: "Sibling Ch1", body: { type: "doc", content: [] }, bookId: siblingId });
    try {
      const sibling = await listChapters(siblingId);
      expect(sibling).toHaveLength(1);
      const book1Ids = new Set((await listChapters(DEFAULT_BOOK_ID)).map((c) => c.id));
      expect(sibling.every((c) => !book1Ids.has(c.id))).toBe(true);
    } finally {
      await deleteBookCascade(siblingId);
    }
  });

  it("returns an EMPTY list for a book with no chapters (never the seeded book's)", async () => {
    // A freshly minted book has zero chapters. The un-filtered bug would return
    // the seeded book's chapters here; the scoped query returns [].
    const id = `test-scope2-${randomUUID()}`;
    await insertBook({ id, name: "Throwaway", worldId: DEFAULT_WORLD_ID });
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
    await insertBook({ id, name: "Before", worldId: DEFAULT_WORLD_ID });
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
