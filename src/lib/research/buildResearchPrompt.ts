import { CARDS_SENTINEL } from "@/lib/research/streamParse";

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
 * The `CARDS_SENTINEL` delimiter line MUST be emitted verbatim: the route splits
 * on it to capture suggested cards. Dropping it silently breaks card capture.
 */
export function buildResearchPrompt(
  question: string,
  threadTitle: string | undefined,
  gazetteer: string,
  hasWeb = false,
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

  const user = [
    threadTitle ? `Thread: ${threadTitle}` : "",
    gazetteer ? `Gazetteer (the writer's wiki):\n${gazetteer}` : "Gazetteer: (empty)",
    "",
    `Writer asks: ${question}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}
