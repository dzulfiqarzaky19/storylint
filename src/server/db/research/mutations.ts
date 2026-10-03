import { query, one, withTransaction } from "@/server/db/pool";
import { fromEpochMs } from "@/server/db/sql";
import type { PropositionRow, ResearchScope, ResearchThreadRow } from "@/domain/types";
import type { WikiWriteConfirmation } from "@/domain/result";

export async function upsertKeptCard(input: {
  propositionId: string;
  keptAt: number;
}): Promise<void> {
  const res = await query(
    `UPDATE propositions SET kept_at = ${fromEpochMs("$2")} WHERE id = $1`,
    [input.propositionId, input.keptAt],
  );
  if ((res.rowCount ?? 0) === 0) {
    throw new Error(`upsertKeptCard: no proposition ${input.propositionId}`);
  }
}

export async function deleteKeptCard(propositionId: string): Promise<boolean> {
  const res = await query(
    `UPDATE propositions SET kept_at = NULL
      WHERE id = $1 AND kept_at IS NOT NULL AND in_wiki = FALSE`,
    [propositionId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function markKeptInWiki(
  propositionId: string,
  _confirmation: WikiWriteConfirmation,
): Promise<void> {
  await query(
    `UPDATE propositions SET in_wiki = TRUE WHERE id = $1 AND kept_at IS NOT NULL`,
    [propositionId],
  );
}

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

export async function getNextResearchThreadSortOrder(worldId: string): Promise<number> {
  const res = await one<{ maxSort: number | null }>(
    `SELECT MAX(sort_order) AS "maxSort" FROM research_threads WHERE world_id = $1`,
    [worldId],
  );
  return (res?.maxSort ?? -1) + 1;
}

export async function insertResearchThread(input: {
  id: string;
  title: string;
  subtitle: string;
  sortOrder: number;
  scope: ResearchScope;
  worldId: string;
}): Promise<ResearchThreadRow> {
  const res = await one<ResearchThreadRow>(
    `INSERT INTO research_threads (id, world_id, title, subtitle, scope, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, subtitle, sort_order AS "sortOrder", scope, world_id AS "worldId"`,
    [input.id, input.worldId, input.title, input.subtitle, input.scope, input.sortOrder],
  );
  if (!res) throw new Error("insertResearchThread: no row returned");
  return res;
}

export interface ResearchCardInput {
  id: string;
  kind: string;
  title: string;
  body: string;
  asKind: string;
}

export interface ResearchTurnPairInput {
  threadId: string;
  youId: string;
  themId: string;
  who: { you: string; them: string };
  question: string;
  reply: string;
  cards: ResearchCardInput[];
  autoTitle?: string;
}

export interface PersistedTurnRef {
  id: string;
  ordinal: number;
}

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

export async function deleteThread(threadId: string): Promise<void> {
  await query(`DELETE FROM research_threads WHERE id = $1`, [threadId]);
}

// A world always keeps at least one thread. The FOR UPDATE lock stops two
// concurrent deletes from each seeing the other's thread as the survivor.
export async function deleteLastThreadGuarded(threadId: string): Promise<boolean> {
  return withTransaction(async (client) => {
    const siblings = await client.query(
      `SELECT id FROM research_threads
        WHERE world_id = (SELECT world_id FROM research_threads WHERE id = $1)
        FOR UPDATE`,
      [threadId],
    );
    if ((siblings.rowCount ?? 0) <= 1) return false;
    await client.query(`DELETE FROM research_threads WHERE id = $1`, [threadId]);
    return true;
  });
}

export async function updateThreadTitle(input: {
  threadId: string;
  title: string;
}): Promise<void> {
  await query(`UPDATE research_threads SET title = $2 WHERE id = $1`, [
    input.threadId,
    input.title,
  ]);
}
