import { getResearchThread, listResearchThreads } from "@/server/db/research/queries";
import type { ResearchSnapshot, ResearchThreadRow } from "@/domain/types";

export const INITIAL_VISIBLE_MAX_ORDINAL = 3;

export const EMPTY_RESEARCH_SNAPSHOT: ResearchSnapshot = {
  question: "",
  threadId: "",
  turns: [],
  initialVisibleTurnIds: [],
  threads: [],
};

export function selectResearchThread(
  threads: ResearchThreadRow[],
  threadId: string | undefined,
): ResearchThreadRow | null {
  if (threads.length === 0) return null;
  return threads.find((t) => t.id === threadId) ?? threads[0]!;
}

export async function loadResearchThreads(worldId: string): Promise<ResearchThreadRow[]> {
  return listResearchThreads(worldId);
}

export async function loadResearchSnapshot(
  threadId: string | undefined,
  worldId: string,
): Promise<ResearchSnapshot> {
  const threads = await loadResearchThreads(worldId);
  const selected = selectResearchThread(threads, threadId);
  if (!selected) return EMPTY_RESEARCH_SNAPSHOT;
  const turns = await getResearchThread(selected.id);
  const initialVisibleTurnIds = turns
    .filter((t) => t.ordinal <= INITIAL_VISIBLE_MAX_ORDINAL)
    .map((t) => t.id);
  return {
    question: selected.title,
    threadId: selected.id,
    turns,
    initialVisibleTurnIds,
    threads,
  };
}
