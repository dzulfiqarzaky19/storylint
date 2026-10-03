import { splitStreamedAnswer } from "@/domain/research/streamParse";
import type { ResearchTurnWithCards } from "@/domain/types";

const AI_ASK_KINDS: readonly string[] = [
  "character",
  "world",
  "organization",
  "lore",
  "beat",
  "question",
];

export interface NormalizedCard {
  id: string;
  kind: string;
  title: string;
  body: string;
  asKind: string;
  forEntry?: string;
}

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
  buffer: string;
  completed: boolean;
  threadId: string;
  question: string;
  youId: string;
  themId: string;
  persist: (args: PersistArgs) => Promise<PersistResult>;
}

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

export async function finalizeStreamedAnswer(
  input: FinalizeInput,
): Promise<{ youTurn: ResearchTurnWithCards; themTurn: ResearchTurnWithCards } | null> {
  if (!input.completed) return null;

  const { reply, cards } = splitStreamedAnswer(input.buffer);

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
