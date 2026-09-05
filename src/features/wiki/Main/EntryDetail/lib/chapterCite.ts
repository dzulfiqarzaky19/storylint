import type { ChapterAppearanceRow } from "@/lib/domain/types";

// A book id like "book-lotm-2" carries its ordinal as the trailing number.
// Returns the number for the "Book N" label, or null when the id has none.
export function bookNumberOf(bookId: string | null): number | null {
  if (!bookId) return null;
  const m = bookId.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

/**
 * A bare "Ch. 1" is ambiguous the moment a book past the first is in play
 * (Book 2 Ch. 1 vs Book 1 Ch. 1), so the book is labelled whenever ANY
 * appearance in the set sits in a numbered book other than book 1. The decision
 * is set-wide, not per-row: a one-book entry stays clean, and a multi-book entry
 * labels every row so the rows stay comparable.
 */
export function chapterCitesFor(appearances: ChapterAppearanceRow[]): string[] {
  const bookNos = appearances.map((a) => bookNumberOf(a.bookId));
  const showBook = bookNos.some((n) => n !== null && n > 1);
  return appearances.map((a, i) => {
    const bookNo = bookNos[i];
    return showBook && bookNo != null
      ? `Book ${bookNo} · Ch. ${a.chapter}`
      : `Ch. ${a.chapter}`;
  });
}
