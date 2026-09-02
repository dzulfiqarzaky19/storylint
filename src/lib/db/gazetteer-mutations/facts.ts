// ============================================================================
// Fact write helpers
// Split out of the former monolithic gazetteer-mutations.ts (T-ARCH-12). Product
// rule 1 (WikiWriteConfirmation token) and all SQL are unchanged; only file
// boundaries moved.
// ============================================================================

import { one, query, rows } from "../pool";
import { type FactRow } from "../../domain/types";
import { type WikiWriteConfirmation } from "../../actions/confirmation";

/**
 * WIKI WRITE (product rule 1). Insert a new fact on an entry. Requires a
 * WikiWriteConfirmation token, so it is only callable from a confirmed path
 * (addSuggestionAsFact / confirmCard). Returns the created row (camelCase).
 */
export async function insertFact(
  input: {
    id: string;
    entryId: string;
    key: string;
    value: string;
    fresh: boolean;
    sortOrder: number;
    // F7 (S4) list divergence: omitted / undefined => book_id NULL = universe
    // canon (shows in every book), preserving the pre-S4 behavior of every
    // existing caller byte-for-byte. A book id stamps this fact as book-only.
    bookId?: string;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<FactRow> {
  const res = await one<FactRow>(
    // Idempotent on id (mirrors insertEntry): re-confirming a card with a stable
    // fact id (e.g. the enrich path's `prop-fact-<propId>`) updates the fact in
    // place instead of PK-violating or minting a duplicate. Random-uuid callers
    // (addSuggestionAsFact) never collide, so their behavior is unchanged.
    `INSERT INTO facts (id, entry_id, key, value, fresh, sort_order, book_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       key = EXCLUDED.key,
       value = EXCLUDED.value,
       fresh = EXCLUDED.fresh,
       sort_order = EXCLUDED.sort_order,
       book_id = EXCLUDED.book_id
     RETURNING id,
               entry_id  AS "entryId",
               key,
               value,
               fresh,
               sort_order AS "sortOrder"`,
    [input.id, input.entryId, input.key, input.value, input.fresh, input.sortOrder, input.bookId ?? null],
  );
  // one() returns null only on empty result; INSERT ... RETURNING always yields a row.
  if (!res) throw new Error("insertFact: no row returned");
  return res;
}

/** Move a fact to a different entry (drag a fact tile between entries). */
export async function updateFactEntry(input: {
  factId: string;
  toEntryId: string;
  sortOrder: number;
}): Promise<void> {
  await query(
    `UPDATE facts SET entry_id = $2, sort_order = $3 WHERE id = $1`,
    [input.factId, input.toEntryId, input.sortOrder],
  );
}

/** Clear the "fresh" highlight on a fact once it has settled. */
export async function clearFactFresh(factId: string): Promise<void> {
  await query(`UPDATE facts SET fresh = FALSE WHERE id = $1`, [factId]);
}

// ---- Entries (shelf order) ------------------------------------------------

/**
 * WIKI WRITE (product rule 1). HARD-delete a single fact by id. A fact is a
 * low-stakes wiki detail (no cascade), so it removes the row outright without a
 * tombstone. Requires a confirmation token, mirroring insertFact (defence in
 * depth on every wiki write).
 */
export async function deleteFact(
  factId: string,
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await query(`DELETE FROM facts WHERE id = $1`, [factId]);
}

/**
 * Highest sort_order among an entry's facts, or 0 if it has none. Used by the
 * enrich path to append a new fact at the end of the target entry's fact list.
 */
export async function getMaxSortOrderForFacts(entryId: string): Promise<number> {
  const res = await rows<{ maxSort: number | null }>(
    `SELECT MAX(sort_order) AS "maxSort" FROM facts WHERE entry_id = $1`,
    [entryId],
  );
  return res[0]?.maxSort ?? 0;
}

// ---- Categories + category "delete" (F9-B; was F6-S5 category_labels) ------
//
// F9-B: categories are user-extensible data rows (the `categories` table) that
// REPLACED the fixed kind enum + `category_labels` override table. A category's
// `label` is the single source for the header text (reads no longer coalesce
// against a separate override table). Renaming/resetting a category touches only
// the categories row — no entry/fact/tie — so it is NOT a wiki-knowledge write
// (product rule 1) and needs no confirmation token. Creating a category likewise
// adds no wiki knowledge (an empty category), so it needs no token. "Delete
// category" is the one exception: it is a BULK soft-delete of every entry of that
// category, so it reuses the S2 softDeleteEntry gate and DEMANDS a
// WikiWriteConfirmation.

/**
 * WIKI WRITE (product rule 1). Patch a subset of a fact's fields (key/value).
 * Only the provided fields are written. No-op if neither was provided.
 */
export async function updateFact(
  input: { id: string; key?: string; value?: string },
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [input.id];
  if (input.key !== undefined) sets.push(`key = $${params.push(input.key)}`);
  if (input.value !== undefined) sets.push(`value = $${params.push(input.value)}`);
  if (sets.length === 0) return;
  await query(`UPDATE facts SET ${sets.join(", ")} WHERE id = $1`, params);
}


// ---- World membership (TCK-023, W-4b: the "share" op) ---------------------
// world_entities is the M2M membership junction (PRIMARY KEY(world_id, entity_id)).
// An entry stays HOME to its universe_id; world membership is ADDITIVE — a link
// row makes the entity appear in that world's loadWorldSnapshot (which reads
// membership through `JOIN world_entities`). STRUCTURAL, not wiki CONTENT (it adds
// no fact/prose to the entry, only a grouping), so — like insertWorld — it needs
// NO WikiWriteConfirmation token.
