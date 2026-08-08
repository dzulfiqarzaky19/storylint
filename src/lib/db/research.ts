// Research screen loader. Composes the Phase 1 read (getResearchThread) with
// the thread metadata (title/subtitle) and the initial-visible boundary, so the
// server component and client screen share one typed shape. Now MULTI-THREAD
// (Track B): the Research screen has a left index of threads and loads whichever
// thread the URL selects (?thread=<id>), defaulting to the first by sort_order.
//
// Lives in its own file (not queries.ts) to avoid concurrent edits on the
// shared read layer. Read-only.

import { getResearchThread, listResearchThreads } from "./queries";
import type { ResearchTurnWithCards, ResearchThreadRow } from "../domain/types";

/** Stable thread id for the seeded conversation (matches seed.ts THREAD_ID). */
export const RESEARCH_THREAD_ID = "salt-debt";

/**
 * The question the writer is turning over for the seeded first thread. A thread
 * row carries a title/subtitle; for the original salt-debt thread we keep the
 * hand-written question copy. Other threads use their title as the question.
 */
export const RESEARCH_QUESTION = "If a salt-name is a debt, who is collecting it?";

const QUESTION_BY_THREAD: Record<string, string> = {
  [RESEARCH_THREAD_ID]: RESEARCH_QUESTION,
};

/**
 * Turns with ordinal <= this are shown on first render; higher ordinals are the
 * deferred `more` turns, revealed when a prompt chip is clicked (HANDOFF §6/§9.4).
 */
export const INITIAL_VISIBLE_MAX_ORDINAL = 3;

export interface ResearchSnapshot {
  question: string;
  threadId: string;
  turns: ResearchTurnWithCards[];
  /** Ids of the turns visible before any prompt chip is clicked. */
  initialVisibleTurnIds: string[];
  /** Every thread, for the LEFT index (Track B). Ordered by sort_order. */
  threads: ResearchThreadRow[];
}

/**
 * List all threads for the left index. Falls back to a single synthetic entry
 * for the seeded thread when the table is empty (older DBs before Track B).
 */
export async function loadResearchThreads(): Promise<ResearchThreadRow[]> {
  const threads = await listResearchThreads();
  if (threads.length > 0) return threads;
  return [
    { id: RESEARCH_THREAD_ID, title: "Salt as debt", subtitle: "", sortOrder: 0 },
  ];
}

/**
 * Load the full Research snapshot for one thread. `threadId` defaults to the
 * first thread by sort_order; an unknown id also falls back to the first so a
 * stale URL never renders an empty screen.
 */
export async function loadResearchSnapshot(
  threadId?: string,
): Promise<ResearchSnapshot> {
  const threads = await loadResearchThreads();
  const selected =
    threads.find((t) => t.id === threadId) ?? threads[0]!;
  const turns = await getResearchThread(selected.id);
  const initialVisibleTurnIds = turns
    .filter((t) => t.ordinal <= INITIAL_VISIBLE_MAX_ORDINAL)
    .map((t) => t.id);
  return {
    question: QUESTION_BY_THREAD[selected.id] ?? selected.title,
    threadId: selected.id,
    turns,
    initialVisibleTurnIds,
    threads,
  };
}
