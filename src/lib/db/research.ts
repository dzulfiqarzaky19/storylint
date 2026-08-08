// Research screen loader. Composes the Phase 1 read (getResearchThread) with
// the fixed thread metadata (question, thread id) and the initial-visible
// boundary, so the server component and client screen share one typed shape.
//
// Lives in its own file (not queries.ts) to avoid concurrent edits on the
// shared read layer. Read-only.

import { getResearchThread } from "./queries";
import type { ResearchTurnWithCards } from "../domain/types";

/** Stable thread id for the seeded conversation (matches seed.ts THREAD_ID). */
export const RESEARCH_THREAD_ID = "salt-debt";

/**
 * The question the writer is turning over. Not persisted as a row — it is the
 * fixed subject of this thread (HANDOFF §6 Research). Rendered in the question
 * block.
 */
export const RESEARCH_QUESTION = "If a salt-name is a debt, who is collecting it?";

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
}

/** Load the full Research snapshot for the seeded thread. */
export async function loadResearchSnapshot(): Promise<ResearchSnapshot> {
  const turns = await getResearchThread(RESEARCH_THREAD_ID);
  const initialVisibleTurnIds = turns
    .filter((t) => t.ordinal <= INITIAL_VISIBLE_MAX_ORDINAL)
    .map((t) => t.id);
  return {
    question: RESEARCH_QUESTION,
    threadId: RESEARCH_THREAD_ID,
    turns,
    initialVisibleTurnIds,
  };
}
