import { rows, one } from "@/server/db/pool";
import type {
  ResearchProposition,
  ResearchThreadRow,
  ResearchTurnRow,
  ResearchTurnWithCards,
  WorldKeptCardRow,
} from "@/domain/types";

export async function getResearchThread(
  threadId: string,
): Promise<ResearchTurnWithCards[]> {
  const [turns, cards] = await Promise.all([
    rows<ResearchTurnRow>(
      `SELECT id, thread_id AS "threadId", ordinal, side, who, text
       FROM research_turns WHERE thread_id = $1 ORDER BY ordinal`,
      [threadId],
    ),
    rows<ResearchProposition>(
      `SELECT p.id, p.turn_id AS "turnId", p.kind, p.title, p.body,
              p.as_kind AS "asKind", p.sort_order AS "sortOrder",
              p.kept_at IS NOT NULL AS kept, p.in_wiki AS "inWiki"
       FROM propositions p
       JOIN research_turns t ON t.id = p.turn_id
       WHERE t.thread_id = $1
       ORDER BY p.sort_order, p.id`,
      [threadId],
    ),
  ]);

  const cardsByTurn = new Map<string, ResearchProposition[]>();
  for (const card of cards) {
    const list = cardsByTurn.get(card.turnId) ?? [];
    list.push(card);
    cardsByTurn.set(card.turnId, list);
  }

  return turns.map((t) => ({ ...t, cards: cardsByTurn.get(t.id) ?? [] }));
}

export async function listResearchThreads(worldId: string): Promise<ResearchThreadRow[]> {
  return rows<ResearchThreadRow>(
    `SELECT id, title, subtitle, sort_order AS "sortOrder", scope, world_id AS "worldId"
     FROM research_threads
     WHERE world_id = $1
     ORDER BY sort_order, id`,
    [worldId],
  );
}

export async function getResearchThreadWorldId(
  threadId: string,
): Promise<string | null> {
  const row = await one<{ worldId: string }>(
    `SELECT world_id AS "worldId" FROM research_threads WHERE id = $1`,
    [threadId],
  );
  return row?.worldId ?? null;
}

export async function getWorldKeptCards(worldId: string): Promise<WorldKeptCardRow[]> {
  return rows<WorldKeptCardRow>(
    `SELECT p.id      AS "propositionId",
            p.kind    AS "kind",
            p.title   AS "title",
            p.body    AS "body",
            p.in_wiki AS "inWiki",
            th.id     AS "threadId",
            th.title  AS "threadTitle"
     FROM propositions p
     JOIN research_turns t    ON t.id = p.turn_id
     JOIN research_threads th ON th.id = t.thread_id
     WHERE th.world_id = $1 AND p.kept_at IS NOT NULL AND p.in_wiki = FALSE
     ORDER BY p.kept_at DESC`,
    [worldId],
  );
}
