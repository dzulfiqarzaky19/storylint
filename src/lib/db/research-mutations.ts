// /research WRITE layer (mirrors the read layer in ./research-queries.ts).
// Thread/turn/kept-card mutations. Not wiki knowledge writes except
// markKeptInWiki, which still requires the confirmation token.
import { query, one, rows, withTransaction } from "./pool";
import { DEFAULT_WORLD_ID, DEFAULT_UNIVERSE_ID } from "./scope";
import type { KeptCardRow, PropositionRow } from "../domain/types";
import type { WikiWriteConfirmation } from "../actions/confirmation";

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

/** Next free sort_order for a new research thread (max + 1, or 0 if none). */
export async function getNextResearchThreadSortOrder(
  worldId?: string,
): Promise<number> {
  // T-RESEARCH-2: order a new thread relative to its OWN world's threads when a
  // world is given (so each world's rail numbers from 0), else the global max.
  const res = worldId
    ? await rows<{ maxSort: number | null }>(
        `SELECT MAX(sort_order) AS "maxSort" FROM research_threads WHERE world_id = $1`,
        [worldId],
      )
    : await rows<{ maxSort: number | null }>(
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
  universeId?: string;
  worldId?: string;
}): Promise<import("../domain/types").ResearchThreadRow> {
  // F7: universe_id is NOT NULL (S1b contract). T-RESEARCH-2: world_id is NOT
  // NULL too — a thread is grounded in ONE world. Default to the active
  // universe's DEFAULT world only when the caller omits worldId (legacy callers);
  // the research action always passes the active world so a new thread lands in
  // the world the writer is viewing (never silently in the default world).
  const worldId = input.worldId ?? DEFAULT_WORLD_ID;
  // A thread's universe MUST be its world's own universe. The /research UI passes
  // only worldId, so derive universe_id FROM the world row rather than the global
  // DEFAULT_UNIVERSE_ID constant: that constant is `universe-${DEFAULT_BOOK_SLUG}`
  // and drifted from the seed's real default id ('mol'), so falling back to it made
  // every +New thread on the default world insert a nonexistent universe_id and
  // throw research_threads_universe_id_fkey. Keying the lookup on the world we are
  // about to reference keeps the FK satisfied for any world regardless of id drift.
  // (Same order plot-mutations.ts already uses: explicit -> world row -> constant.)
  const universeId =
    input.universeId ??
    (
      await one<{ universeId: string }>(
        `SELECT universe_id AS "universeId" FROM worlds WHERE id = $1`,
        [worldId],
      )
    )?.universeId ??
    DEFAULT_UNIVERSE_ID;
  const res = await one<import("../domain/types").ResearchThreadRow>(
    `INSERT INTO research_threads (id, title, subtitle, sort_order, scope, universe_id, world_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, title, subtitle, sort_order AS "sortOrder", scope, world_id AS "worldId"`,
    [input.id, input.title, input.subtitle, input.sortOrder, input.scope, universeId, worldId],
  );
  if (!res) throw new Error("insertResearchThread: no row returned");
  return res;
}

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

/**
 * R3 last-thread floor: delete a thread ONLY if it is not the last one in its
 * world, so a live world's /research rail never drops to zero (the UI's
 * removeThread re-opens a fresh thread on the client, but a raw action call had
 * no such guard - this closes that hole server-side).
 *
 * Race-safe by construction: the count and the delete share ONE transaction, and
 * the count locks the world's thread rows with FOR UPDATE, so two concurrent
 * deletes cannot both observe count > 1 and drive the world to zero. A thread with
 * NULL world_id has no world floor to protect and is always deletable. Returns
 * false (deleted nothing) when the thread is its world's last one, so the caller
 * can surface a "can't delete the last thread" error instead of a silent no-op.
 */
export async function deleteLastThreadGuarded(threadId: string): Promise<boolean> {
  return withTransaction(async (client) => {
    const owner = await client.query<{ world_id: string | null }>(
      `SELECT world_id FROM research_threads WHERE id = $1`,
      [threadId],
    );
    const worldId = owner.rows[0]?.world_id ?? null;
    if (worldId !== null) {
      const siblings = await client.query(
        `SELECT id FROM research_threads WHERE world_id = $1 FOR UPDATE`,
        [worldId],
      );
      if (siblings.rowCount !== null && siblings.rowCount <= 1) return false;
    }
    await client.query(`DELETE FROM research_turns WHERE thread_id = $1`, [threadId]);
    await client.query(`DELETE FROM research_threads WHERE id = $1`, [threadId]);
    return true;
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
