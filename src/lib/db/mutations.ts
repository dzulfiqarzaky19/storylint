// Parameterized write helpers (INSERT/UPDATE) for the mutation paths in
// src/lib/actions/*. Companion to the read-only queries.ts (owned by calf);
// kept in a separate file to avoid concurrent-edit collisions on the shared
// query layer. Same rules as queries.ts:
//
//   * ALWAYS use $1/$2/... placeholders. NEVER interpolate values into SQL.
//   * Column names are snake_case in the DB; result aliases map to camelCase.
//
// These are minimal, clearly-named helpers. They do not enforce product rules;
// the confirmation invariant (product rule 1) lives at the action layer.

import { query, one, rows, withTransaction } from "./pool";
import type { FactRow, TieRow, ResolvedMarkRow, KeptCardRow, PropositionRow } from "../domain/types";
import type { WikiWriteConfirmation } from "../actions/confirmation";

// Helpers marked "WIKI WRITE" below require a WikiWriteConfirmation token (product
// rule 1). The token parameter is intentionally unused at runtime — its presence
// in the signature makes a non-confirmed call a compile-time type error, so these
// helpers cannot be reached from any path that did not pass through the gate.

// ---- Facts ----------------------------------------------------------------

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
  },
  _confirmation: WikiWriteConfirmation,
): Promise<FactRow> {
  const res = await one<FactRow>(
    `INSERT INTO facts (id, entry_id, key, value, fresh, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id,
               entry_id  AS "entryId",
               key,
               value,
               fresh,
               sort_order AS "sortOrder"`,
    [input.id, input.entryId, input.key, input.value, input.fresh, input.sortOrder],
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
 * Persist an entry's shelf placement and sort order (the persisted shelf order
 * the spec demands: `shelf` + `sortOrder`). Called after a tile is dropped.
 */
export async function updateEntryShelfOrder(input: {
  entryId: string;
  shelf: string;
  sortOrder: number;
}): Promise<void> {
  await query(
    `UPDATE entries SET shelf = $2, sort_order = $3 WHERE id = $1`,
    [input.entryId, input.shelf, input.sortOrder],
  );
}

// ---- Entries (creation) ---------------------------------------------------

/**
 * WIKI WRITE (product rule 1). Create a new entry (Research "Yes, write it in").
 * Requires a confirmation token, so it is only callable from the confirmed
 * confirmCard path. Idempotent on id (re-confirming a card updates in place).
 */
export async function insertEntry(
  input: {
    id: string;
    kind: string;
    name: string;
    catalogueNo: string;
    note: string;
    summary: string;
    shelf: string;
    sortOrder: number;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await query(
    `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       kind = EXCLUDED.kind,
       name = EXCLUDED.name,
       catalogue_no = EXCLUDED.catalogue_no,
       note = EXCLUDED.note,
       summary = EXCLUDED.summary,
       shelf = EXCLUDED.shelf,
       sort_order = EXCLUDED.sort_order`,
    [
      input.id,
      input.kind,
      input.name,
      input.catalogueNo,
      input.note,
      input.summary,
      input.shelf,
      input.sortOrder,
    ],
  );
}

/**
 * Persist the full order of one shelf after a drag. `orderedIds` is the shelf's
 * entries top-to-bottom; each is set to `shelf` with sort_order = its index, so
 * the DB row order matches exactly what the UI shows. One statement per row keeps
 * it parameterized (no value interpolation). Small dataset (<= 15 entries total).
 */
export async function reorderShelf(input: {
  shelf: string;
  orderedIds: string[];
}): Promise<void> {
  for (let i = 0; i < input.orderedIds.length; i++) {
    await query(`UPDATE entries SET shelf = $2, sort_order = $3 WHERE id = $1`, [
      input.orderedIds[i],
      input.shelf,
      i,
    ]);
  }
}

// ---- Ties -----------------------------------------------------------------

/**
 * WIKI WRITE (product rule 1). Insert a directional tie. The prototype seeds
 * both directions; callers do so explicitly. Requires a confirmation token.
 */
export async function insertTie(
  input: {
    id: string;
    fromEntryId: string;
    toEntryId: string;
    rel: string;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<TieRow> {
  const res = await one<TieRow>(
    `INSERT INTO ties (id, from_entry_id, to_entry_id, rel)
     VALUES ($1, $2, $3, $4)
     RETURNING id,
               from_entry_id AS "fromEntryId",
               to_entry_id   AS "toEntryId",
               rel`,
    [input.id, input.fromEntryId, input.toEntryId, input.rel],
  );
  if (!res) throw new Error("insertTie: no row returned");
  return res;
}

// ---- Chapters (manuscript) ------------------------------------------------

/** Save a chapter's ProseMirror JSON body. */
export async function saveChapterBody(input: {
  number: number;
  body: unknown;
}): Promise<void> {
  await query(
    `UPDATE chapters SET body = $2 WHERE number = $1`,
    [input.number, JSON.stringify(input.body)],
  );
}

/**
 * Refresh the book-wide phrase index for ONE chapter (Tier 2 cross-chapter
 * recurrence). Atomically deletes this chapter's existing rows and inserts the
 * freshly-extracted phrase counts, so the index always reflects the current
 * body (a phrase removed from the chapter disappears from the index). Ranking
 * data only; never gates a mark. `phrases` maps a (lowercased) phrase to its
 * occurrence count in this chapter; an empty map just clears the chapter's rows.
 */
export async function replacePhraseMentions(input: {
  chapterNumber: number;
  phrases: ReadonlyMap<string, number>;
}): Promise<void> {
  // Batch the whole refresh into two statements (one DELETE + one set-based
  // INSERT via UNNEST) so a chapter with N distinct phrases costs one round-trip
  // instead of N. The (phrase, chapter_number) pairs are unique by construction
  // — `phrases` is a Map, so each phrase appears once — but ON CONFLICT stays as
  // defence: it makes a same-chapter re-run idempotent and keeps a stray
  // duplicate from aborting the batch ("cannot affect row a second time"). Both
  // statements share one transaction so the index is never half-refreshed.
  const phrases = [...input.phrases.keys()];
  const counts = [...input.phrases.values()];
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM phrase_mentions WHERE chapter_number = $1`, [
      input.chapterNumber,
    ]);
    if (phrases.length === 0) return; // empty map just clears the chapter's rows
    await client.query(
      `INSERT INTO phrase_mentions (phrase, chapter_number, count)
       SELECT p, $2, c
         FROM UNNEST($1::text[], $3::int[]) AS t(p, c)
       ON CONFLICT (phrase, chapter_number)
         DO UPDATE SET count = EXCLUDED.count`,
      [phrases, input.chapterNumber, counts],
    );
  });
}

/** Next chapter number (max+1, or 1 when empty). For appending a new chapter. */
export async function getNextChapterNumber(): Promise<number> {
  const res = await one<{ next: number }>(
    `SELECT COALESCE(MAX(number), 0) + 1 AS next FROM chapters`,
  );
  return res?.next ?? 1;
}

/** Insert a new chapter with an initial body. Returns its number. */
export async function insertChapter(input: {
  id: string;
  number: number;
  title: string;
  body: unknown;
}): Promise<{ id: string; number: number; title: string }> {
  const res = await one<{ id: string; number: number; title: string }>(
    `INSERT INTO chapters (id, number, title, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, number, title`,
    [input.id, input.number, input.title, JSON.stringify(input.body)],
  );
  return res!;
}

// ---- Resolved marks (Write) -----------------------------------------------

/**
 * Persist a mark resolution by its stable markKey (§7). Idempotent upsert so a
 * dismissed mark never returns even after the paragraph moves.
 */
export async function upsertResolvedMark(input: {
  markKey: string;
  resolution: string;
  resolvedAt: number;
}): Promise<ResolvedMarkRow> {
  const res = await one<ResolvedMarkRow>(
    `INSERT INTO resolved_marks (mark_key, resolution, resolved_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (mark_key)
       DO UPDATE SET resolution = EXCLUDED.resolution, resolved_at = EXCLUDED.resolved_at
     RETURNING mark_key    AS "markKey",
               resolution,
               resolved_at AS "resolvedAt"`,
    [input.markKey, input.resolution, input.resolvedAt],
  );
  if (!res) throw new Error("upsertResolvedMark: no row returned");
  return res;
}

// ---- Kept cards (Research) ------------------------------------------------

/** Keep a proposition card on the Kept board (idempotent by propositionId). */
export async function upsertKeptCard(input: {
  propositionId: string;
  keptAt: number;
}): Promise<KeptCardRow> {
  const res = await one<KeptCardRow>(
    `INSERT INTO kept_cards (proposition_id, kept_at, in_wiki)
     VALUES ($1, $2, FALSE)
     ON CONFLICT (proposition_id) DO UPDATE SET kept_at = EXCLUDED.kept_at
     RETURNING proposition_id AS "propositionId",
               kept_at        AS "keptAt",
               in_wiki        AS "inWiki"`,
    [input.propositionId, input.keptAt],
  );
  if (!res) throw new Error("upsertKeptCard: no row returned");
  return res;
}

/**
 * Remove a proposition from the Kept board ("un-keep"). Idempotent.
 *
 * A card that has already been written into the wiki (`in_wiki = TRUE`) must NOT
 * be removable this way: its row is the sole record that the wiki entry came
 * from this card, and the wiki entry itself is not deleted here. Deleting the
 * row would leave an orphaned wiki entry while the board reverts the card to
 * "not kept / not in wiki" on reload — a permanent state/data desync. So the
 * DELETE is scoped to non-in-wiki rows. Returns true if a row was removed.
 */
export async function deleteKeptCard(propositionId: string): Promise<boolean> {
  const res = await query(
    `DELETE FROM kept_cards WHERE proposition_id = $1 AND in_wiki = FALSE`,
    [propositionId],
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * WIKI WRITE (product rule 1). Mark a kept card as written into the wiki (after
 * confirmCard). Requires a confirmation token.
 */
export async function markKeptInWiki(
  propositionId: string,
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await query(
    `UPDATE kept_cards SET in_wiki = TRUE WHERE proposition_id = $1`,
    [propositionId],
  );
}

// ---- Dismissed suggestions (Wiki poster "Leave it") -----------------------

/** Record a dismissed suggestion by its stable key (idempotent). */
export async function insertDismissedSuggestion(suggestionKey: string): Promise<void> {
  await query(
    `INSERT INTO dismissed_suggestions (suggestion_key)
     VALUES ($1)
     ON CONFLICT (suggestion_key) DO NOTHING`,
    [suggestionKey],
  );
}

// ---- Reads used by mutation paths -----------------------------------------
// These are SELECTs, but they live here (not queries.ts) because they exist
// solely to support the write paths above (e.g. confirmCard needs the source
// proposition and the next free sortOrder). Keeping them beside their callers
// avoids concurrent edits to the shared read layer.

/** Fetch a single proposition (source of a confirmed entry). */
export async function getProposition(id: string): Promise<PropositionRow | null> {
  return one<PropositionRow>(
    `SELECT id,
            turn_id  AS "turnId",
            kind,
            title,
            body,
            as_kind  AS "asKind",
            sort_order AS "sortOrder"
     FROM propositions WHERE id = $1`,
    [id],
  );
}

/** Highest sort_order currently on a shelf, or 0 if the shelf is empty. */
export async function getMaxSortOrderForShelf(shelf: string): Promise<number> {
  const res = await rows<{ maxSort: number | null }>(
    `SELECT MAX(sort_order) AS "maxSort" FROM entries WHERE shelf = $1`,
    [shelf],
  );
  return res[0]?.maxSort ?? 0;
}

// ---- Research threads (Track B — multi-thread sidebar) --------------------
// APPEND-ONLY: writes for "New thread". Creating a thread is NOT a wiki write
// (product rule 1), so it needs no confirmation token — it only adds an empty
// conversation column, never an entry. No existing helper above is modified.

/** Next free sort_order for a new research thread (max + 1, or 0 if none). */
export async function getNextResearchThreadSortOrder(): Promise<number> {
  const res = await rows<{ maxSort: number | null }>(
    `SELECT MAX(sort_order) AS "maxSort" FROM research_threads`,
  );
  return (res[0]?.maxSort ?? -1) + 1;
}

/**
 * Insert a new research thread row (the "New thread" action). Parameterized;
 * subtitle defaults to '' at the DB layer but we pass it explicitly. Returns
 * the created row (camelCase) so the caller can navigate to it.
 */
export async function insertResearchThread(input: {
  id: string;
  title: string;
  subtitle: string;
  sortOrder: number;
  scope: import("../domain/types").ResearchScope;
}): Promise<import("../domain/types").ResearchThreadRow> {
  const res = await one<import("../domain/types").ResearchThreadRow>(
    `INSERT INTO research_threads (id, title, subtitle, sort_order, scope)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, subtitle, sort_order AS "sortOrder", scope`,
    [input.id, input.title, input.subtitle, input.sortOrder, input.scope],
  );
  if (!res) throw new Error("insertResearchThread: no row returned");
  return res;
}

// ---- Manual authoring (Track A — edit in place) ---------------------------
// WIKI WRITE (product rule 1). Editing an existing entry/fact changes the wiki,
// so both helpers require a WikiWriteConfirmation token. A manual edit is
// inherently confirmed (the user typed and saved it), so the action layer mints
// the token via confirmWikiWrite({ confirmed: true }). Each builds a partial
// UPDATE from only the provided fields, parameterized. No existing helper is
// modified.

/**
 * WIKI WRITE (product rule 1). Patch a subset of an entry's scalar fields
 * (name/note/summary/catalogueNo). Only the provided fields are written.
 * No-op (returns without a query) if no updatable field was provided.
 */
export async function updateEntryFields(
  input: {
    id: string;
    name?: string;
    note?: string;
    summary?: string;
    catalogueNo?: string;
  },
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [input.id];
  if (input.name !== undefined) sets.push(`name = $${params.push(input.name)}`);
  if (input.note !== undefined) sets.push(`note = $${params.push(input.note)}`);
  if (input.summary !== undefined) sets.push(`summary = $${params.push(input.summary)}`);
  if (input.catalogueNo !== undefined) sets.push(`catalogue_no = $${params.push(input.catalogueNo)}`);
  if (sets.length === 0) return;
  await query(`UPDATE entries SET ${sets.join(", ")} WHERE id = $1`, params);
}

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

// ---- Research turns (F2a — persist an AI ask atomically) ------------------
// askResearchAi becomes a WRITING action: the writer's question ("you") and the
// AI reply ("them") plus the reply's proposition cards persist ALL-OR-NOTHING in
// ONE transaction. A them-turn with no you-turn (or orphan cards) is worse than
// no write, so any failure rolls the whole pair back. Not a wiki write (product
// rule 1) — these are conversation turns, not entries — so no confirmation token.

/** One proposition card to persist under the AI ("them") turn. */
export interface ResearchCardInput {
  id: string;
  kind: string;
  title: string;
  body: string;
  asKind: string;
}

/** The you-turn + them-turn (+cards) to persist for one AI ask. */
export interface ResearchTurnPairInput {
  threadId: string;
  youId: string;
  themId: string;
  who: { you: string; them: string };
  question: string;
  reply: string;
  cards: ResearchCardInput[];
  /**
   * When set, auto-title the thread IN THE SAME TXN: if the thread's current
   * title is empty or the "New thread" placeholder, update it to this value.
   * A non-placeholder title is left untouched (the writer's first question
   * names the thread once, not on every ask).
   */
  autoTitle?: string;
}

/** A persisted turn's identity + assigned ordinal, returned for the reducer. */
export interface PersistedTurnRef {
  id: string;
  ordinal: number;
}

/**
 * Persist a question/answer pair (+cards) for one thread in a SINGLE transaction.
 *
 * ORDINAL-IN-TXN (the hard correctness condition): the next ordinal is computed
 * as MAX(ordinal)+1 for this thread INSIDE the same transaction as the inserts,
 * so two concurrent asks can never read the same MAX and collide — the you-turn
 * takes MAX+1 and the them-turn MAX+2 under one lock. Date.now() ordinals are
 * wrong (collide in the same millisecond, non-deterministic ordering).
 *
 * ATOMICITY: you-turn, them-turn, and every card insert run on one client; any
 * failure rolls back the whole pair (the caller then persists nothing and the
 * in-memory reducer never appends a half-pair).
 *
 * Rejects an empty threadId so a turn can never be written with thread_id = ''
 * (the bug this feature fixes). Returns the two turns' ids + assigned ordinals.
 */
export async function insertResearchTurnPair(
  input: ResearchTurnPairInput,
): Promise<{ you: PersistedTurnRef; them: PersistedTurnRef }> {
  if (!input.threadId) {
    throw new Error("insertResearchTurnPair: threadId is required (refusing to write an orphan turn)");
  }
  return withTransaction(async (client) => {
    const maxRes = await client.query<{ maxOrdinal: number | null }>(
      `SELECT MAX(ordinal) AS "maxOrdinal" FROM research_turns WHERE thread_id = $1`,
      [input.threadId],
    );
    const base = (maxRes.rows[0]?.maxOrdinal ?? -1) + 1;
    const youOrdinal = base;
    const themOrdinal = base + 1;

    await client.query(
      `INSERT INTO research_turns (id, thread_id, ordinal, side, who, text)
       VALUES ($1, $2, $3, 'you', $4, $5)`,
      [input.youId, input.threadId, youOrdinal, input.who.you, input.question],
    );
    await client.query(
      `INSERT INTO research_turns (id, thread_id, ordinal, side, who, text)
       VALUES ($1, $2, $3, 'them', $4, $5)`,
      [input.themId, input.threadId, themOrdinal, input.who.them, input.reply],
    );

    for (let i = 0; i < input.cards.length; i++) {
      const c = input.cards[i]!;
      await client.query(
        `INSERT INTO propositions (id, turn_id, kind, title, body, as_kind, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [c.id, input.themId, c.kind, c.title, c.body, c.asKind, i],
      );
    }

    // Auto-title in the SAME txn: name the thread from the first question only
    // while it still carries the empty/"New thread" placeholder, so title and
    // turns commit together (or roll back together).
    if (input.autoTitle !== undefined) {
      await client.query(
        `UPDATE research_threads
            SET title = $2
          WHERE id = $1 AND (title = '' OR title = 'New thread')`,
        [input.threadId, input.autoTitle],
      );
    }

    return {
      you: { id: input.youId, ordinal: youOrdinal },
      them: { id: input.themId, ordinal: themOrdinal },
    };
  });
}

/**
 * Hard-delete a research thread and everything under it, in ONE transaction.
 *
 * research_turns.thread_id is BARE TEXT with NO foreign key (schema.sql), so a
 * DELETE on research_threads does NOT cascade to its turns — the turns would be
 * orphaned. We therefore delete the turns FIRST (which DOES cascade to their
 * propositions, and propositions cascade to kept_cards), then the thread row.
 * Both statements share one transaction so a thread is never left half-deleted.
 */
export async function deleteThread(threadId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM research_turns WHERE thread_id = $1`, [threadId]);
    await client.query(`DELETE FROM research_threads WHERE id = $1`, [threadId]);
  });
}

/** Update a research thread's title (F2a auto-title). Parameterized. */
export async function updateThreadTitle(input: {
  threadId: string;
  title: string;
}): Promise<void> {
  await query(`UPDATE research_threads SET title = $2 WHERE id = $1`, [
    input.threadId,
    input.title,
  ]);
}
