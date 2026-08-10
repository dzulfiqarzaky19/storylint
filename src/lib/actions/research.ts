"use server";

// =============================================================================
// Research Server Actions (HANDOFF §8)
//
// PRODUCT RULE 1 — "Nothing enters the wiki without an explicit confirmation."
//
//   `confirmCard` is the ONLY action in this file that writes to the wiki, and
//   it is gated on an explicit `confirmed: true` param via `confirmWikiWrite()`.
//   The other write path in the whole app is `addSuggestionAsFact` in wiki.ts.
//     - keepCard toggles the Kept board (kept_cards); NOT the wiki.
//     - proposeCard sets a card "pending" and reveals the confirmation strip;
//       it writes nothing until confirmCard.
//     - cancelPending clears the pending state and writes nothing
//       (HANDOFF §8: "`Cancel` writes nothing").
//
//   insertEntry (the wiki write) requires a WikiWriteConfirmation token, so the
//   type checker rejects any attempt to create an entry from a non-confirmed
//   path — the invariant is enforced at the action boundary, not just the UI.
// =============================================================================

import { confirmWikiWrite } from "./confirmation";
import {
  markKeptInWiki,
  upsertKeptCard,
  deleteKeptCard,
  insertEntry,
  insertFact,
  getProposition,
  getMaxSortOrderForShelf,
  getMaxSortOrderForFacts,
  insertResearchThread,
  getNextResearchThreadSortOrder,
  insertResearchTurnPair,
  deleteThread as deleteThreadRow,
} from "../db/mutations";
import { randomUUID } from "node:crypto";
import type { Kind, ResearchScope } from "../domain/types";
import type { ResearchTurnWithCards } from "../domain/types";
import { complete, completeJson, aiEnabled } from "../ai/saarouters";
import { loadWikiSnapshot, getEntry } from "../db/queries";
import { deriveThreadTitle } from "../research/title";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** kind -> shelf (HANDOFF §6). Matches the seed's KIND_SHELF. */
const KIND_SHELF: Record<Kind, string> = {
  character: "people",
  world: "places",
  organization: "orders",
  lore: "lore",
};

/**
 * Toggle a proposition card on the Kept board ("Keep" ⇄ "Kept"). Persists to
 * kept_cards, NOT the wiki. Mirrors reducer action `KEEP_CARD`.
 */
export async function keepCard(
  propositionId: string,
  kept: boolean,
): Promise<ActionResult> {
  try {
    if (kept) {
      await upsertKeptCard({ propositionId, keptAt: Date.now() });
    } else {
      await deleteKeptCard(propositionId);
    }
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
}

/**
 * Set a card "pending" ("Make it an entry") which reveals the confirmation
 * strip. Writes NOTHING to the wiki. Mirrors reducer action `PROPOSE_CARD`.
 */
export async function proposeCard(propositionId: string): Promise<ActionResult> {
  void propositionId;
  // No persistence: pending is session state. Server action kept for uniform pairing.
  return { ok: true, data: undefined };
}

/**
 * Clear the pending card without writing ("Cancel"). Mirrors reducer action
 * `CANCEL_PENDING`.
 */
export async function cancelPending(): Promise<ActionResult> {
  // No persistence: clears reducer pending state only.
  return { ok: true, data: undefined };
}

// ---- WIKI WRITE (confirmation-gated) --------------------------------------

/**
 * WIKI WRITE (product rule 1). Write a pending proposition into the wiki as a
 * new entry ("Yes, write it in"). One of the two only paths that write to the
 * wiki, so it REQUIRES an explicit confirmation.
 *
 * Steps (all under the minted token): create the entry, mark the source card
 * as kept + in_wiki. The card is auto-kept so it appears on the board flipped
 * to "In the wiki" (HANDOFF §8 / README behavior table).
 *
 * @param input.confirmed must be the literal `true` — the confirmation gate.
 */
export async function confirmCard(input: {
  propositionId: string;
  /** Editable entry fields the confirmation strip collected. */
  entry: {
    name: string;
    kind: Kind;
    summary: string;
  };
  /**
   * F6 enrich-vs-duplicate: when set, the writer chose to fold this card into an
   * EXISTING entry (from `recommendEnrichTarget`) rather than mint a new one. We
   * add the card's summary as a fact on that entry instead of inserting a new
   * `prop-` entry. A soft-deleted / missing target is rejected (getEntry filters
   * `deleted_at IS NULL`), so a card can never enrich a tombstone.
   */
  enrichEntryId?: string;
  confirmed: true;
}): Promise<ActionResult<{ entryId: string }>> {
  // Mint the token; omitting `confirmed: true` is a compile-time error. This is
  // the single gate that authorizes every wiki write below.
  const confirmation = confirmWikiWrite({ confirmed: input.confirmed });

  try {
    const prop = await getProposition(input.propositionId);
    if (!prop) {
      return { ok: false, error: `Unknown proposition: ${input.propositionId}` };
    }

    // F6 ENRICH BRANCH — fold the card into an existing entry instead of minting
    // a duplicate. The target must be LIVE: getEntry filters `deleted_at IS NULL`,
    // so a null here means the entry is soft-deleted or gone — reject rather than
    // silently resurrect a tombstone or write an orphan fact.
    if (input.enrichEntryId) {
      const target = await getEntry(input.enrichEntryId);
      if (!target) {
        return {
          ok: false,
          error: `Cannot enrich a removed entry: ${input.enrichEntryId}`,
        };
      }
      // Stable fact id keyed by the proposition so re-confirming the same card
      // updates the fact in place (insertFact is now idempotent) instead of
      // stacking duplicates on the target entry.
      const factId = `prop-fact-${input.propositionId}`;
      const nextFactSort = (await getMaxSortOrderForFacts(input.enrichEntryId)) + 1;
      await insertFact(
        {
          id: factId,
          entryId: input.enrichEntryId,
          key: input.entry.name,
          value: input.entry.summary,
          fresh: true,
          sortOrder: nextFactSort,
        },
        confirmation,
      );

      // The card is still resolved: keep it on the board flipped to "In the wiki".
      await upsertKeptCard({ propositionId: input.propositionId, keptAt: Date.now() });
      await markKeptInWiki(input.propositionId, confirmation);

      return { ok: true, data: { entryId: input.enrichEntryId } };
    }

    // Derive a stable entry id from the proposition so re-confirming is idempotent.
    const entryId = `prop-${input.propositionId}`;
    const shelf = KIND_SHELF[input.entry.kind];
    const nextSort = (await getMaxSortOrderForShelf(shelf)) + 1;

    await insertEntry(
      {
        id: entryId,
        kind: input.entry.kind,
        name: input.entry.name,
        catalogueNo: "—",
        note: prop.kind.toLowerCase(),
        summary: input.entry.summary,
        shelf,
        sortOrder: nextSort,
      },
      confirmation,
    );

    // The card must exist on the board before we can flip it to in_wiki.
    await upsertKeptCard({ propositionId: input.propositionId, keptAt: Date.now() });
    await markKeptInWiki(input.propositionId, confirmation);

    return { ok: true, data: { entryId } };
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---- AI: grounded research answer (session-only, NOT a wiki write) ---------
//
// The writer types a question / half-thought. We ground the model on the
// current wiki snapshot and ask for a short conversational answer plus 2-3
// proposition cards. The result is returned as reducer-shaped turns and lives
// only in session state — it writes NOTHING to the wiki. A card only becomes a
// wiki entry through the existing confirmCard gate (product rule 1 intact).

const AI_ASK_KINDS: readonly string[] = ["character", "world", "organization", "lore", "beat", "question"];

interface AiProposition {
  kind?: string;
  title?: string;
  body?: string;
  asKind?: string;
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
  if (!aiEnabled()) {
    return { ok: false, error: "AI is not configured. Add SAAROUTERS_API_KEY to .env.local." };
  }

  try {
    // Ground on the wiki so answers stay inside the writer's own world.
    const wiki = await loadWikiSnapshot();
    const gazetteer = wiki.entries
      .map((e) => {
        const facts = e.facts.map((f) => `${f.key}: ${f.value}`).join("; ");
        return `- ${e.name} (${e.kind})${e.summary ? ` — ${e.summary}` : ""}${facts ? ` [${facts}]` : ""}`;
      })
      .join("\n");

    const system = [
      "You are a story-consistency collaborator for a fiction writer.",
      "You help them think through their own world. Ground every answer ONLY in the gazetteer provided; never invent contradicting facts.",
      "Reply as a thoughtful writing partner in 2-4 sentences, then propose 2-3 concrete 'cards' the writer could keep.",
      "Return STRICT JSON only, no prose outside JSON, shaped exactly as:",
      '{"reply": string, "cards": [{"kind": "character|world|organization|lore|beat|question", "title": string, "body": string, "asKind": "character|world|organization|lore"}]}',
      "title: <=6 words. body: one or two sentences. asKind: the wiki kind this card would become if written in.",
    ].join("\n");

    const user = [
      input.threadTitle ? `Thread: ${input.threadTitle}` : "",
      gazetteer ? `Gazetteer (the writer's wiki):\n${gazetteer}` : "Gazetteer: (empty)",
      "",
      `Writer asks: ${question}`,
    ]
      .filter(Boolean)
      .join("\n");

    let answer: AiAnswer;
    try {
      answer = await completeJson<AiAnswer>({
        system,
        messages: [{ role: "user", content: user }],
        maxTokens: 900,
        temperature: 0.7,
      });
    } catch {
      // Fallback: if strict JSON failed, take a plain reply with no cards.
      const reply = await complete({
        system: "You are a story-consistency collaborator. Answer in 2-4 sentences, grounded in the writer's world.",
        messages: [{ role: "user", content: user }],
        maxTokens: 400,
        temperature: 0.7,
      });
      answer = { reply, cards: [] };
    }

    const reply = (answer.reply ?? "").trim() || "Here's a thought.";
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
      return {
        id: `ai-card-${stamp}-${rid}-${i}`,
        kind: AI_ASK_KINDS.includes(c.kind ?? "") ? (c.kind as string) : "lore",
        title: (c.title ?? "Untitled").trim(),
        body: (c.body ?? "").trim(),
        asKind,
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
        sortOrder: i,
        kept: false,
        inWiki: false,
      })),
    };

    return { ok: true, data: { turns: [youTurn, themTurn] } };
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
}

// ---- Research threads (Track B) — NOT a wiki write ------------------------
// Creating a thread opens an empty conversation column; it never writes an
// entry, so it needs no confirmation token (product rule 1 is about wiki
// writes). Returns the new thread id so the client can navigate to it.

export async function createThread(input?: {
  title?: string;
  subtitle?: string;
  scope?: ResearchScope;
}): Promise<ActionResult<{ threadId: string }>> {
  try {
    const id = randomUUID();
    const sortOrder = await getNextResearchThreadSortOrder();
    const row = await insertResearchThread({
      id,
      title: input?.title?.trim() || "New thread",
      subtitle: input?.subtitle?.trim() ?? "",
      sortOrder,
      scope: input?.scope ?? "chat",
    });
    return { ok: true, data: { threadId: row.id } };
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
}

// Hard-delete a whole thread. `research_turns.thread_id` is bare text with no FK
// (schema.sql:93), so deleting the thread row does NOT cascade to its turns —
// the mutation removes turns FIRST, then the thread row, in one txn (props and
// kept_cards cascade from turns). Not a wiki write; needs no confirmation token.
export async function deleteThread(input: {
  threadId: string;
}): Promise<ActionResult<{ threadId: string }>> {
  const threadId = (input.threadId ?? "").trim();
  if (!threadId) return { ok: false, error: "No thread to delete." };
  try {
    await deleteThreadRow(threadId);
    return { ok: true, data: { threadId } };
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
}
