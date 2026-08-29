import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { getChaptersForBook } from "@/lib/db/chapter-queries";
import { insertWorld, insertChapter } from "@/lib/db/mutations";

// -----------------------------------------------------------------------------
// T-ARCH-2 — getChaptersForBook book-scope (INTEGRATION, real Postgres).
//
// F8 "whole novel" export is ONE book. Filtering lives in SQL
// (`WHERE book_id = $1`), so a wiki/bag edit cannot bleed a sibling book's
// chapters into the export.
//
// Two throwaway worlds (each born with its own book via insertWorld), each
// given one numbered-1 chapter. Listing book A must return A's chapter and
// NEVER B's.
//
// MUTATION (run at ready): drop `WHERE book_id = $1` in getChaptersForBook.
// The "no sibling-book bleed" assertion flips RED. Inverse replace; re-GREEN.
//
// SHARED-DB HYGIENE: ids are `test-tarch2-ch-*`. Fixture hard-deleted in
// afterAll in FK order. Seeded books are never touched.
// -----------------------------------------------------------------------------

loadEnv();

const UNI_A = `test-tarch2-ch-ua-${randomUUID()}`;
const WORLD_A = `test-tarch2-ch-wa-${randomUUID()}`;
const BOOK_A = `test-tarch2-ch-ba-${randomUUID()}`;
const CH_A = `test-tarch2-ch-ca-${randomUUID()}`;
const UNI_B = `test-tarch2-ch-ub-${randomUUID()}`;
const WORLD_B = `test-tarch2-ch-wb-${randomUUID()}`;
const BOOK_B = `test-tarch2-ch-bb-${randomUUID()}`;
const CH_B = `test-tarch2-ch-cb-${randomUUID()}`;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  await query(`INSERT INTO universes (id, name) VALUES ($1, 'TARCH2 Ch A')`, [UNI_A]);
  await query(`INSERT INTO universes (id, name) VALUES ($1, 'TARCH2 Ch B')`, [UNI_B]);
  await insertWorld({ id: WORLD_A, universeId: UNI_A, title: "Ch World A", bookId: BOOK_A });
  await insertWorld({ id: WORLD_B, universeId: UNI_B, title: "Ch World B", bookId: BOOK_B });
  await insertChapter({
    id: CH_A,
    number: 1,
    title: "A1",
    body: { type: "doc", content: [] },
    bookId: BOOK_A,
  });
  await insertChapter({
    id: CH_B,
    number: 1,
    title: "B1",
    body: { type: "doc", content: [] },
    bookId: BOOK_B,
  });
});

afterAll(async () => {
  await query(`DELETE FROM chapters WHERE book_id IN ($1, $2)`, [BOOK_A, BOOK_B]);
  await query(`DELETE FROM research_threads WHERE world_id IN ($1, $2)`, [WORLD_A, WORLD_B]);
  await query(`DELETE FROM books WHERE id IN ($1, $2)`, [BOOK_A, BOOK_B]);
  await query(`DELETE FROM worlds WHERE id IN ($1, $2)`, [WORLD_A, WORLD_B]);
  await query(`DELETE FROM universes WHERE id IN ($1, $2)`, [UNI_A, UNI_B]);
  await closePool();
});

describe("getChaptersForBook book scope (T-ARCH-2)", () => {
  it("returns only the requested book's chapters (no sibling-book bleed)", async () => {
    const listed = await getChaptersForBook(BOOK_A);
    const ids = listed.map((c) => c.id);

    expect(listed.length).toBe(1);
    expect(ids).toContain(CH_A);
    expect(ids).not.toContain(CH_B);
    expect(listed[0]!.title).toBe("A1");
  });
});
