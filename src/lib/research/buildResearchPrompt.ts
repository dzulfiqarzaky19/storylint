import { CARDS_SENTINEL } from "@/lib/research/streamParse";
import type { TurnSide } from "@/lib/domain/types";

/**
 * A single prior conversation turn as the model should see it. Structural subset
 * of ResearchTurnRow (side + text) — the only fields that carry meaning into the
 * prompt. `who` is a display label; ordinal/id are DB bookkeeping.
 */
export interface PriorTurn {
  side: TurnSide;
  text: string;
}

/**
 * How many of the MOST RECENT prior turns to feed back to the model as
 * conversation memory. Bounds the prompt so long threads stay cheap; recent
 * turns matter most for continuity. Chosen at 15 (writer's request).
 */
export const HISTORY_TURN_CAP = 15;

/**
 * Pure seam (research-memory fix): render prior thread turns into a transcript
 * block the model can read, so the Collaborator REMEMBERS earlier turns instead
 * of replying statelessly ("I don't have our earlier conversation").
 *
 * - Keeps only the LAST `maxTurns` turns (recency window) so long threads don't
 *   blow the context; order is preserved oldest→newest within that window.
 * - `you` = the writer, `them` = the Collaborator (the model's own past voice).
 * - Empty input (no prior turns) returns "" so the caller's prompt stays
 *   byte-identical to the historyless path — this is what preserves the F5/F10
 *   locks. Blank-text turns are dropped (never emit an empty speaker line).
 */
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

/**
 * Build the Option-C research prompt: prose first, then the sentinel, then a
 * strict cards JSON array.
 *
 * F5 (fully-free research chat): there is NO scope narrowing. The AI is framed
 * to draw on the ENTIRE wiki and answer freely — no "only answer within scope"
 * self-policing directive. Extracted from the stream route's inline `buildPrompt`
 * (minus the `scope` param and the `scopeDirective(scope)` line) so the
 * free-framing decision is a pure, testable unit (F5-S1).
 *
 * MEMORY: `history` (prior thread turns) is OPTIONAL and ADDITIVE — when empty or
 * absent the prompt is byte-identical to the historyless path (F5/F10 locks
 * hold). When present, a "Conversation so far" block is inserted BEFORE the
 * current question so the model has continuity within the thread.
 *
 * The `CARDS_SENTINEL` delimiter line MUST be emitted verbatim: the route splits
 * on it to capture suggested cards. Dropping it silently breaks card capture.
 */
export function buildResearchPrompt(
  question: string,
  threadTitle: string | undefined,
  gazetteer: string,
  hasWeb = false,
  history: readonly PriorTurn[] = [],
): { system: string; user: string } {
  // F10 GAP1: when the caller has appended real WEB SOURCES to the user message,
  // the model must be told they are a legitimate grounding source to cite by URL
  // — otherwise the gazetteer-only line below makes it refuse ("I can't search
  // the web"). This directive appears ONLY when web context is actually present;
  // with no web context the system prompt stays byte-identical to F5 (the
  // network-free path is untouched). The writer's wiki is still preferred for
  // in-world canon and contradicting facts are still never invented.
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
    // Option C: prose, then the exact sentinel line, then a strict JSON array of
    // cards. The route splits on the sentinel; the writer never sees it or the
    // JSON. Emitting the sentinel verbatim is REQUIRED for cards to be captured.
    `Then, on its own, output EXACTLY this delimiter line (copy it verbatim, including the invisible characters):${CARDS_SENTINEL}`,
    "Immediately after the delimiter, output STRICT JSON only: an array of 2-3 cards shaped exactly as:",
    '[{"kind": "character|world|organization|lore|beat|question", "title": string, "body": string, "asKind": "character|world|organization|lore"}]',
    "title: <=6 words. body: one or two sentences. asKind: the wiki kind this card would become if written in.",
    "Output nothing after the JSON array.",
  ].join("\n");

  // MEMORY: a compacted chat transcript of the recent thread turns, LLM-chat
  // style (speaker-prefixed lines) but flattened into the user message so the
  // model reads it as "what we've already said". Empty when there is no prior
  // history — the block collapses out via filter(Boolean) and the prompt stays
  // byte-identical to the historyless path (F5/F10 locks hold).
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
