"use server";

// ============================================================================
// Research AI server actions (grounded answer; session-only)
// Split out of the former monolithic research.ts (T-ARCH-9). runAction/runActionBare
// envelopes are unchanged; only file boundaries moved.
// ============================================================================

import { type ActionResult, runActionBare } from "../confirmation";
import { insertResearchTurnPair } from "../../db/research-mutations";
import { randomUUID } from "node:crypto";
import { type ResearchTurnWithCards } from "../../domain/types";
import { aiEnabled } from "../../ai/saarouters";
import {
  AI_OFF,
  askGroundedJson,
  askGroundedText,
  type PromptPart,
} from "../../ai/groundedAsk";
import { loadWikiSnapshot, loadWorldSnapshot } from "../../db/gazetteer";
import { getResearchThreadWorldId } from "../../db/research-queries";
import { deriveThreadTitle } from "../../research/title";
import { loadWebSearchConfig } from "../../websearch/search/config";
import { buildSearchImpl, retrieve } from "../../websearch/retrieve";
import { enforceCitations } from "../../websearch/ground/enforceCitations";
import { collectAllowedUrls, renderWebContext } from "../../research/webSearchAdapter";

const AI_ASK_KINDS: readonly string[] = ["character", "world", "organization", "lore", "beat", "question"];

interface AiProposition {
  kind?: string;
  title?: string;
  body?: string;
  asKind?: string;
  forEntry?: string;
}

interface AiAnswer {
  reply?: string;
  cards?: AiProposition[];
}

/** True when the AI gateway is configured (for UI gating). */
export async function isAiEnabled(): Promise<boolean> {
  return aiEnabled();
}

export async function askResearchAi(input: {
  question: string;
  threadId: string;
  threadTitle?: string;
}): Promise<ActionResult<{ turns: ResearchTurnWithCards[] }>> {
  const question = input.question.trim();
  if (!question) return { ok: false, error: "Type a question first." };
  // GUARD: never write a turn against an unresolved thread. snapshot.threadId is
  // the resolved real id; refuse rather than persist an orphan turn (thread_id is
  // bare text with no FK to research_threads).
  const threadId = (input.threadId ?? "").trim();
  if (!threadId) return { ok: false, error: "No active thread to write to." };
  if (!aiEnabled()) return { ok: false, error: AI_OFF };

  return runActionBare(async () => {
    // T-RESEARCH-2 (LOAD-BEARING): ground on the thread's OWN world, not the
    // whole universe. loadWorldSnapshot(threadWorldId) returns only the entities
    // linked to that world, so the AI answers inside the world the thread belongs
    // to (a Blackspade thread never sees Ashkeld canon). Falls back to the
    // whole-wiki snapshot only when the thread has no world (legacy/none), which
    // the NOT NULL migration makes impossible for new rows.
    const threadWorldId = await getResearchThreadWorldId(threadId);
    const wiki = threadWorldId
      ? await loadWorldSnapshot(threadWorldId)
      : await loadWikiSnapshot();
    const system: string[] = [
      "You are a story-consistency collaborator for a fiction writer.",
      "You help them think through their own world. Ground every answer ONLY in the gazetteer provided; never invent contradicting facts.",
      "Reply as a thoughtful writing partner in 2-4 sentences, then propose 2-3 concrete 'cards' the writer could keep.",
      "Return STRICT JSON only, no prose outside JSON, shaped exactly as:",
      '{"reply": string, "cards": [{"kind": "character|world|organization|lore|beat|question", "title": string, "body": string, "asKind": "character|world|organization|lore", "forEntry": string}]}',
      "title: <=6 words. body: one or two sentences. asKind: the wiki kind this card would become if written in.",
      "forEntry: if a card describes a trait, curse, relationship, or detail that BELONGS TO an entry already listed in the gazetteer, you MUST set forEntry to that entry's EXACT name, copied verbatim from the gazetteer list, so it attaches to that entry instead of minting a duplicate. Omit forEntry entirely ONLY when the card introduces a genuinely NEW subject not in the gazetteer.",
    ];

    const wikiGround: PromptPart = {
      heading: "Gazetteer (the writer's wiki):",
      entries: wiki.entries,
      whenEmpty: "Gazetteer: (empty)",
    };

    // F10: real web search. Retrieve + read full-body pages for this question,
    // then append them as grounded prompt context and hold the reply's citations
    // to exactly the URLs we read. Fail-soft: any engine error yields no web
    // context and the answer falls back to wiki-only grounding. Opt-in
    // ACTIVATION: only run live retrieval when web search is CONFIGURED, so a
    // fresh clone boots green with zero surprise network egress.
    let webContext = "";
    let allowedUrls: string[] = [];
    try {
      const cfg = loadWebSearchConfig(process.env);
      if (cfg.enabled) {
        const retrieval = await retrieve(question, {
          searchImpl: buildSearchImpl(cfg),
          maxRead: cfg.maxResults,
        });
        const context = renderWebContext(retrieval);
        allowedUrls = collectAllowedUrls(retrieval);
        if (context) webContext = context;
      }
    } catch {
      // Fail-soft: keep wiki-only prompt, no allowed citations.
      webContext = "";
      allowedUrls = [];
    }

    const user: PromptPart[] = [
      input.threadTitle ? `Thread: ${input.threadTitle}` : false,
      wikiGround,
      `Writer asks: ${question}`,
      webContext ? `\n${webContext}` : false,
    ];
    const webRule = webContext
      ? "Web sources are provided below as CONTEXT blocks with URLs. You MAY ground answers in them and cite their exact URLs; never cite a URL not provided."
      : false;

    const asked = await askGroundedJson<AiAnswer>({
      system: webRule ? [...system, webRule] : system,
      user,
      budget: "full",
      temperature: 0.7,
    });

    let answer: AiAnswer;
    if (asked.ok) {
      answer = asked.data;
    } else {
      // Fallback: strict JSON failed, so take a plain reply with no cards.
      const plain = await askGroundedText({
        system: [
          "You are a story-consistency collaborator. Answer in 2-4 sentences, grounded in the writer's world.",
        ],
        user,
        budget: "brief",
        temperature: 0.7,
      });
      if (!plain.ok) return { ok: false, error: plain.error };
      answer = { reply: plain.data, cards: [] };
    }

    const reply = enforceCitations((answer.reply ?? "").trim() || "Here's a thought.", allowedUrls);
    const cards = (answer.cards ?? [])
      .filter((c) => c && (c.title || c.body))
      .slice(0, 3);

    const stamp = Date.now();
    const rid = randomUUID().slice(0, 8);
    const youId = `ai-you-${stamp}-${rid}`;
    const themId = `ai-them-${stamp}-${rid}`;

    // Normalize the AI cards once, so the SAME shape is persisted and returned.
    const normCards = cards.map((c, i) => {
      const asKind = AI_ASK_KINDS.includes(c.asKind ?? "") ? (c.asKind as string) : "lore";
      const forEntry = c.forEntry?.trim();
      return {
        id: `ai-card-${stamp}-${rid}-${i}`,
        kind: AI_ASK_KINDS.includes(c.kind ?? "") ? (c.kind as string) : "lore",
        title: (c.title ?? "Untitled").trim(),
        body: (c.body ?? "").trim(),
        asKind,
        forEntry: forEntry ? forEntry : undefined,
      };
    });

    // PERSIST (F2a): you + them (+cards) write ALL-OR-NOTHING in one txn, with
    // ordinal = MAX(ordinal)+1 computed INSIDE that txn, and the thread is
    // auto-titled from the first question while it still holds the placeholder.
    // On any failure the whole pair rolls back and the reducer appends nothing.
    const persisted = await insertResearchTurnPair({
      threadId,
      youId,
      themId,
      who: { you: "You", them: "Collaborator" },
      question,
      reply,
      cards: normCards.map((c) => ({
        id: c.id,
        kind: c.kind,
        title: c.title,
        body: c.body,
        asKind: c.asKind,
      })),
      autoTitle: deriveThreadTitle(question),
    });

    // Two turns: the writer's question ("you"), then the AI's answer ("them").
    const youTurn: ResearchTurnWithCards = {
      id: youId,
      threadId,
      ordinal: persisted.you.ordinal,
      side: "you",
      who: "You",
      text: question,
      cards: [],
    };
    const themTurn: ResearchTurnWithCards = {
      id: themId,
      threadId,
      ordinal: persisted.them.ordinal,
      side: "them",
      who: "Collaborator",
      text: reply,
      cards: normCards.map((c, i) => ({
        id: c.id,
        turnId: themId,
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

    return { ok: true, data: { turns: [youTurn, themTurn] } };
  });
}

// ---- Research threads (Track B) — NOT a wiki write ------------------------
// Creating a thread opens an empty conversation column; it never writes an
// entry, so it needs no confirmation token (product rule 1 is about wiki
// writes). Returns the new thread id so the client can navigate to it.
