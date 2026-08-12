// F2b — completion-time finalizer for a streamed research answer.
//
// This is the HARD GATE, isolated as a pure function so it can be proven without
// a live gateway. The route handler streams prose to the client, assembles the
// FULL buffer, and calls this once the upstream stream resolves. Exactly one of
// two things happens:
//
//   - stream COMPLETED and the assembled reply is non-empty  => persist the
//     you/them pair (+cards) ATOMICALLY via the injected persist fn, ONCE, and
//     return the persisted turns for the client's RECONCILE_TURN.
//   - stream ABORTED, errored, or produced an empty reply    => persist NOTHING
//     (no half-pair ever reaches the DB) and return null.
//
// Cards are parsed from the FULL buffer via splitStreamedAnswer (Option C),
// never mid-stream. Card kind/asKind are clamped to the same allowlist and the
// same shape the blocking path (askResearchAi) persists, so a streamed answer
// and a blocking answer are byte-identical in the DB.

import { splitStreamedAnswer } from "./streamParse";
import type { ResearchTurnWithCards } from "../domain/types";

/** The wiki kinds a proposition may claim; anything else clamps to "lore". */
const AI_ASK_KINDS: readonly string[] = [
  "character",
  "world",
  "organization",
  "lore",
  "beat",
  "question",
];

/** One normalized card, shaped exactly like the blocking path persists. */
export interface NormalizedCard {
  id: string;
  kind: string;
  title: string;
  body: string;
  asKind: string;
  forEntry?: string;
}

/** The persist callback the route injects — F2a's atomic insertResearchTurnPair. */
export interface PersistArgs {
  threadId: string;
  youId: string;
  themId: string;
  question: string;
  reply: string;
  cards: NormalizedCard[];
}

export interface PersistResult {
  you: { ordinal: number };
  them: { ordinal: number };
}

export interface FinalizeInput {
  /** The full assembled stream buffer (prose + optional sentinel + cards JSON). */
  buffer: string;
  /** True only when the upstream stream reached message_stop cleanly. */
  completed: boolean;
  threadId: string;
  question: string;
  youId: string;
  themId: string;
  /** Atomic persist (F2a). Called AT MOST ONCE, and only on the persist path. */
  persist: (args: PersistArgs) => Promise<PersistResult>;
}

/**
 * Clamp AI-proposed cards to the persisted shape: allow-listed kind/asKind,
 * trimmed title (default "Untitled") and body, stable ids. Mirrors askResearchAi.
 */
export function normalizeStreamedCards(
  cards: { kind?: string; title?: string; body?: string; asKind?: string; forEntry?: string }[],
  idPrefix: string,
): NormalizedCard[] {
  return cards.map((c, i) => {
    const forEntry = c.forEntry?.trim();
    return {
      id: `${idPrefix}-${i}`,
      kind: AI_ASK_KINDS.includes(c.kind ?? "") ? (c.kind as string) : "lore",
      title: (c.title ?? "Untitled").trim(),
      body: (c.body ?? "").trim(),
      asKind: AI_ASK_KINDS.includes(c.asKind ?? "") ? (c.asKind as string) : "lore",
      forEntry: forEntry ? forEntry : undefined,
    };
  });
}

/**
 * Decide whether to persist and, if so, build the two persisted turns.
 *
 * Returns null when NOTHING was persisted (aborted / errored / empty reply);
 * the caller then emits no `done` payload and the client's placeholder is left
 * for a client-side rollback. Returns the you/them turns when a pair was
 * committed, ready for the client's RECONCILE_TURN.
 */
export async function finalizeStreamedAnswer(
  input: FinalizeInput,
): Promise<{ youTurn: ResearchTurnWithCards; themTurn: ResearchTurnWithCards } | null> {
  // GATE 1: only a cleanly completed stream may persist. An abort/error must
  // leave the DB untouched — no half-pair.
  if (!input.completed) return null;

  const { reply, cards } = splitStreamedAnswer(input.buffer);

  // GATE 2: an empty reply persists nothing (mirrors the blocking path refusing
  // to write a blank turn). Whitespace-only is empty after split's trim.
  if (!reply) return null;

  const normCards = normalizeStreamedCards(cards, `${input.themId}-card`);

  const persisted = await input.persist({
    threadId: input.threadId,
    youId: input.youId,
    themId: input.themId,
    question: input.question,
    reply,
    cards: normCards,
  });

  const youTurn: ResearchTurnWithCards = {
    id: input.youId,
    threadId: input.threadId,
    ordinal: persisted.you.ordinal,
    side: "you",
    who: "You",
    text: input.question,
    cards: [],
  };
  const themTurn: ResearchTurnWithCards = {
    id: input.themId,
    threadId: input.threadId,
    ordinal: persisted.them.ordinal,
    side: "them",
    who: "Collaborator",
    text: reply,
    cards: normCards.map((c, i) => ({
      id: c.id,
      turnId: input.themId,
      kind: c.kind,
      title: c.title,
      body: c.body,
      asKind: c.asKind,
      forEntry: c.forEntry,
      sortOrder: i,
      kept: false,
      inWiki: false,
    })),
  };

  return { youTurn, themTurn };
}
