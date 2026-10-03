import { CARDS_SENTINEL } from "@/domain/research/streamParse";
import type { TurnSide } from "@/domain/types";

export interface PriorTurn {
  side: TurnSide;
  text: string;
}

export const HISTORY_TURN_CAP = 15;

export function renderHistory(
  turns: readonly PriorTurn[],
  maxTurns = HISTORY_TURN_CAP,
): string {
  if (turns.length === 0 || maxTurns <= 0) return "";
  const recent = turns.slice(-maxTurns);
  const lines = recent
    .filter((t) => t.text.trim().length > 0)
    .map((t) => `${t.side === "you" ? "Writer" : "Collaborator"}: ${t.text.trim()}`);
  return lines.length === 0 ? "" : lines.join("\n");
}

export function buildResearchPrompt(
  question: string,
  threadTitle: string | undefined,
  gazetteer: string,
  hasWeb = false,
  history: readonly PriorTurn[] = [],
): { system: string; user: string } {
  const webDirective = hasWeb
    ? [
        "IMPORTANT: the user's message includes a 'Web sources retrieved for this question' block. These are REAL web pages fetched live for this question. You DO have web access here — never say you cannot search the web or cannot cite external sources. Answer the question directly using those web sources and cite them inline by their listed URL. For real-world (non-fiction) questions, answer from the web sources, not from your own memory. Prefer the writer's wiki only for in-world canon. Cite ONLY URLs listed in that block.",
      ]
    : [];
  const system = [
    "You are a story-consistency collaborator for a fiction writer.",
    "You help them think through their own world. Ground in-world answers in the gazetteer provided; never invent contradicting facts.",
    "You can draw on the writer's ENTIRE wiki; answer freely across all of it, with no scope restriction.",
    ...webDirective,
    "Reply as a thoughtful writing partner in 2-4 sentences of PLAIN PROSE first.",
    `Then, on its own, output EXACTLY this delimiter line (copy it verbatim, including the invisible characters):${CARDS_SENTINEL}`,
    "Immediately after the delimiter, output STRICT JSON only: an array of 2-3 cards shaped exactly as:",
    '[{"kind": "character|world|organization|lore|beat|question", "title": string, "body": string, "asKind": "character|world|organization|lore", "forEntry": string}]',
    "title: <=6 words. body: one or two sentences. asKind: the wiki kind this card would become if written in.",
    "forEntry: if a card describes a trait, curse, relationship, or detail that BELONGS TO an entry already listed in the Gazetteer, you MUST set forEntry to that entry's EXACT name, copied verbatim from the Gazetteer list, so it attaches to that entry instead of minting a duplicate. Omit forEntry entirely ONLY when the card introduces a genuinely NEW subject that is not in the Gazetteer. Example: if the Gazetteer lists \"Elowen Vance\" and the writer asks for a curse on her, return {\"kind\":\"lore\",\"title\":\"The Ashen Curse\",\"body\":\"...\",\"asKind\":\"lore\",\"forEntry\":\"Elowen Vance\"}.",
    "Classifying kind: use character/world/organization (and the matching asKind) ONLY for a GENUINELY NEW subject worth its own wiki entry. A suggestion or connection about subjects that ALREADY EXIST in the gazetteer is lore or beat — never mint a new character/world/organization card for a recommendation about existing subjects.",
    "Output nothing after the JSON array.",
  ].join("\n");

  const historyBlock = renderHistory(history);
  const user = [
    threadTitle ? `Thread: ${threadTitle}` : "",
    gazetteer ? `Gazetteer (the writer's wiki):\n${gazetteer}` : "Gazetteer: (empty)",
    historyBlock
      ? `Conversation so far (most recent, oldest first — this is what you and the writer have already said; continue it, don't restart):\n${historyBlock}`
      : "",
    "",
    `Writer asks: ${question}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}
