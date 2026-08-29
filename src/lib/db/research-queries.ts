// /research READ layer. SQL for threads, turns, kept cards. research.ts
// composes these into the screen snapshot; this file is the seam so a wiki
// edit in queries.ts cannot break the research rail.
import { rows, one } from "./pool";
import type {
  ResearchTurnRow,
  PropositionRow,
  KeptCardRow,
  ResearchTurnWithCards,
  ResearchProposition,
} from "../domain/types";

export async function getResearchThread(
  threadId: string,
): Promise<ResearchTurnWithCards[]> {
  const [turns, props, kept] = await Promise.all([
    rows<ResearchTurnRow>(
      `SELECT id, thread_id AS "threadId", ordinal, side, who, text
       FROM research_turns WHERE thread_id = $1 ORDER BY ordinal`,
      [threadId],
    ),
    rows<PropositionRow>(
      `SELECT p.id, p.turn_id AS "turnId", p.kind, p.title, p.body,
              p.as_kind AS "asKind", p.sort_order AS "sortOrder"
       FROM propositions p
       JOIN research_turns t ON t.id = p.turn_id
       WHERE t.thread_id = $1
       ORDER BY p.sort_order, p.id`,
      [threadId],
    ),
    rows<KeptCardRow>(
      `SELECT proposition_id AS "propositionId", kept_at AS "keptAt", in_wiki AS "inWiki"
       FROM kept_cards`,
    ),
  ]);

  const keptById = new Map(kept.map((k) => [k.propositionId, k]));
  const cardsByTurn = new Map<string, ResearchProposition[]>();
  for (const p of props) {
    const k = keptById.get(p.id);
    const card: ResearchProposition = {
      ...p,
      kept: Boolean(k),
      inWiki: k?.inWiki ?? false,
    };
    const list = cardsByTurn.get(p.turnId) ?? [];
    list.push(card);
    cardsByTurn.set(p.turnId, list);
  }

  return turns.map((t) => ({ ...t, cards: cardsByTurn.get(t.id) ?? [] }));
}

/**
 * List research threads for the LEFT sidebar, in sort_order (then id as a stable
 * tiebreaker). Column aliases map snake_case -> camelCase.
 *
 * T-RESEARCH-2: WORLD-scoped. Pass `worldId` to list only that world's threads
 * (the sidebar shows the active world's conversations, mirroring how /wiki shows
 * the active world's entries). Omit it to list every thread (used by paths that
 * are not world-scoped, e.g. a global count). Filtering in SQL (not in JS) is
 * mutation-provable: dropping the WHERE bleeds sibling-world threads into the rail.
 */
export async function listResearchThreads(
  worldId?: string,
): Promise<import("../domain/types").ResearchThreadRow[]> {
  if (worldId !== undefined) {
    return rows<import("../domain/types").ResearchThreadRow>(
      `SELECT id, title, subtitle, sort_order AS "sortOrder", scope, world_id AS "worldId"
       FROM research_threads
       WHERE world_id = $1
       ORDER BY sort_order, id`,
      [worldId],
    );
  }
  return rows<import("../domain/types").ResearchThreadRow>(
    `SELECT id, title, subtitle, sort_order AS "sortOrder", scope, world_id AS "worldId"
     FROM research_threads
     ORDER BY sort_order, id`,
  );
}

/**
 * T-RESEARCH-2 (load-bearing): the world_id of ONE thread, so the AI-grounding
 * path (askResearchAi / the stream route) can call loadWorldSnapshot(worldId)
 * and ground the answer on THAT thread's world's linked entries instead of the
 * default-universe canon. Returns null for an unknown thread (caller decides the
 * fallback). Read-only, single row.
 */
export async function getResearchThreadWorldId(
  threadId: string,
): Promise<string | null> {
  const row = await one<{ worldId: string }>(
    `SELECT world_id AS "worldId" FROM research_threads WHERE id = $1`,
    [threadId],
  );
  return row?.worldId ?? null;
}

/**
 * T-RES-E2E-KEPT: every kept card in ONE world, with its source thread — the
 * data behind the WORLD-WIDE Kept board. The board aggregates kept propositions
 * across ALL threads in the active world (not just the open thread), so this
 * walks kept_cards -> propositions -> research_turns -> research_threads and
 * filters on the thread's world_id.
 *
 * The `WHERE th.world_id = $1` is the load-bearing scope: dropping it bleeds
 * sibling-world kept cards onto the board. Filtering in SQL (not in JS after an
 * unfiltered read) is what makes that scope mutation-provable. threadTitle rides
 * along for the "from <thread>" attribution; threadId for click-to-open. In-wiki
 * cards are excluded here — a card written into the wiki leaves the Kept board
 * (Kept is the holding area for propositions NOT yet in the wiki), matching the
 * client-side keptItems filter, so the board never shows an in-wiki row. Ordered
 * newest-kept first.
 */
export async function getWorldKeptCards(
  worldId: string,
): Promise<import("../domain/types").WorldKeptCardRow[]> {
  return rows<import("../domain/types").WorldKeptCardRow>(
    `SELECT p.id       AS "propositionId",
            p.kind     AS "kind",
            p.title    AS "title",
            p.body     AS "body",
            kc.in_wiki AS "inWiki",
            th.id      AS "threadId",
            th.title   AS "threadTitle"
     FROM kept_cards kc
     JOIN propositions p      ON p.id = kc.proposition_id
     JOIN research_turns t    ON t.id = p.turn_id
     JOIN research_threads th ON th.id = t.thread_id
     WHERE th.world_id = $1 AND kc.in_wiki = FALSE
     ORDER BY kc.kept_at DESC`,
    [worldId],
  );
}
