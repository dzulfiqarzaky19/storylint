// ============================================================================
// Entry facet write helpers (F7 S4 scalar override)
// Split out of the former monolithic gazetteer-mutations.ts (T-ARCH-12). Product
// rule 1 (WikiWriteConfirmation token) and all SQL are unchanged; only file
// boundaries moved.
// ============================================================================

import { one } from "../pool";
import { type WikiWriteConfirmation } from "../../actions/confirmation";

export interface EntryFacetRow {
  entryId: string;
  bookId: string;
  name: string | null;
  summary: string | null;
  note: string | null;
}

/**
 * WIKI WRITE (product rule 1). Upsert a per-book scalar override for an entry.
 * PK(entry_id, book_id) => at most one facet row per entry per book, so a repeat
 * override on the same (entry, book) UPDATEs in place rather than duplicating.
 * A NULL column means "no override for that field in this book" — the book view
 * (COALESCE(facet.col, canon.col)) then falls through to universe canon for that
 * field. Passing only { name } leaves summary/note NULL (canon still shows).
 * Requires a confirmation token.
 */
export async function upsertEntryFacet(
  input: {
    entryId: string;
    bookId: string;
    name?: string | null;
    summary?: string | null;
    note?: string | null;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<EntryFacetRow> {
  const res = await one<EntryFacetRow>(
    `INSERT INTO entry_facets (entry_id, book_id, name, summary, note)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (entry_id, book_id) DO UPDATE SET
       name = EXCLUDED.name,
       summary = EXCLUDED.summary,
       note = EXCLUDED.note
     RETURNING entry_id AS "entryId",
               book_id  AS "bookId",
               name,
               summary,
               note`,
    [input.entryId, input.bookId, input.name ?? null, input.summary ?? null, input.note ?? null],
  );
  if (!res) throw new Error("upsertEntryFacet: no row returned");
  return res;
}
