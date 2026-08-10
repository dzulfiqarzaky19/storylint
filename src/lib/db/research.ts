// Research screen loader. Composes the Phase 1 read (getResearchThread) with
// the thread metadata (title/subtitle) and the initial-visible boundary, so the
// server component and client screen share one typed shape. Now MULTI-THREAD
// (Track B): the Research screen has a left index of threads and loads whichever
// thread the URL selects (?thread=<id>), defaulting to the first by sort_order.
//
// Lives in its own file (not queries.ts) to avoid concurrent edits on the
// shared read layer. Read-only.

import { getAllEntries, getResearchThread, listResearchThreads } from "./queries";
import type { ResearchTurnWithCards, ResearchThreadRow, ResearchScope } from "../domain/types";
import {
  availableScopeOptions,
  type ScopeOption,
} from "../research/scopeOptions";

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
  /** The active thread's current scope (drives the switcher's initial value). */
  scope: ResearchScope;
  /**
   * Scope options offered when creating a thread (Chat first, then each wiki
   * kind that has >=1 entry). Derived from the live wiki so empty kinds hide.
   */
  scopeOptions: ScopeOption[];
}

/**
 * The inert snapshot the Research screen renders when there are NO threads at
 * all. Research now starts empty (no seed), so this is a real first-run state,
 * not an error: the screen shows a "no threads yet" empty state and a create
 * affordance rather than a fabricated conversation.
 */
export const EMPTY_RESEARCH_SNAPSHOT: ResearchSnapshot = {
  question: "",
  threadId: "",
  turns: [],
  initialVisibleTurnIds: [],
  threads: [],
  // The inert state has no active thread; a broad Chat scope is the safe default.
  scope: "chat",
  // No entries loaded in the inert state, so only the always-present Chat scope.
  scopeOptions: availableScopeOptions([]),
};

/**
 * Pick which thread to load from the list: the one matching `threadId`, else
 * the first by sort_order (a stale/unknown URL never dead-ends). Returns null
 * when there are NO threads, so the loader returns an empty-state snapshot
 * instead of indexing an empty array.
 */
export function selectResearchThread(
  threads: ResearchThreadRow[],
  threadId: string | undefined,
): ResearchThreadRow | null {
  if (threads.length === 0) return null;
  return threads.find((t) => t.id === threadId) ?? threads[0]!;
}

/**
 * List all threads for the left index, ordered by sort_order. Returns exactly
 * what the DB holds — an EMPTY list when there are no threads (research now
 * starts empty; there is no synthetic seed thread to fall back to).
 */
export async function loadResearchThreads(): Promise<ResearchThreadRow[]> {
  return listResearchThreads();
}

/**
 * Load the full Research snapshot for one thread. `threadId` defaults to the
 * first thread by sort_order; an unknown id also falls back to the first so a
 * stale URL never renders an empty screen. When there are NO threads at all,
 * returns the empty-state snapshot (no crash).
 */
export async function loadResearchSnapshot(
  threadId?: string,
): Promise<ResearchSnapshot> {
  const threads = await loadResearchThreads();
  const selected = selectResearchThread(threads, threadId);
  if (!selected) return EMPTY_RESEARCH_SNAPSHOT;
  const turns = await getResearchThread(selected.id);
  const entries = await getAllEntries();
  const initialVisibleTurnIds = turns
    .filter((t) => t.ordinal <= INITIAL_VISIBLE_MAX_ORDINAL)
    .map((t) => t.id);
  return {
    question: selected.title,
    threadId: selected.id,
    turns,
    initialVisibleTurnIds,
    threads,
    scope: selected.scope,
    scopeOptions: availableScopeOptions(entries),
  };
}
