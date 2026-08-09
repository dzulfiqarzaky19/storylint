"use server";

// =============================================================================
// Write Server Actions (HANDOFF §8)
//
// PRODUCT RULE 1 — "Nothing enters the wiki without an explicit confirmation."
//
//   NONE of this file's actions write to the wiki *directly*. saveManuscript
//   persists the chapter body; openMark is read-only UI state; resolveMark
//   handles the three distinct note actions (§8):
//     - 'text'  → selects the run for editing. No wiki write.
//     - 'leave' → marks the run deliberate; persists the markKey in
//                 resolved_marks so the engine suppresses it. No wiki write.
//     - 'wiki'  → "the wiki is out of date": updates the fact. This MUST go
//                 "through the same confirmation path" (§8). resolveMark does
//                 not itself write the fact — it hands off to the confirmed
//                 wiki path (addSuggestionAsFact / a confirmed fact update),
//                 which is gated by confirmWikiWrite. So the only two wiki-write
//                 paths remain addSuggestionAsFact and confirmCard.
//
// CONTRACT-FIRST: stable signatures; trivial bodies call the query/mutation
// layer, otherwise a typed NOT_IMPLEMENTED stub for a later phase.
// =============================================================================

import {
  saveChapterBody,
  upsertResolvedMark,
  insertChapter,
  getNextChapterNumber,
} from "../db/mutations";
import { randomUUID } from "node:crypto";
import { complete, completeJson, aiEnabled } from "../ai/saarouters";
import { loadWikiSnapshot } from "../db/queries";

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** The three note actions offered under a mark (§8). `actionId` on resolveMark is one of these. */
export type MarkActionId = "wiki" | "text" | "leave";

/**
 * What resolveMark did, so the store and editor can react. For a 'wiki'
 * resolution the wiki write happens via the confirmed wiki path, not here.
 */
export type ResolveMarkOutcome =
  | { kind: "resolved"; markKey: string } // 'leave' → suppressed permanently
  | { kind: "selectForEdit"; quote: string } // 'text' → select the run in the editor
  | { kind: "needsConfirmation"; entryId: string; factKey: string }; // 'wiki' → hand off to confirmed path

// ---- Manuscript persistence (no wiki write) -------------------------------

/**
 * Persist the chapter's ProseMirror JSON body. Per-mutation write, not a
 * debounced write-behind, so a failed save surfaces (§8). Mirrors reducer
 * action `SAVE_MANUSCRIPT`.
 */
export async function saveManuscript(input: {
  chapterNumber: number;
  body: unknown; // ProseMirror document JSON
}): Promise<ActionResult> {
  try {
    await saveChapterBody({ number: input.chapterNumber, body: input.body });
    return { ok: true, data: undefined };
  } catch (err) {
    // Surface, don't swallow (§8): a failed save must reach the user.
    return { ok: false, error: messageOf(err) };
  }
}

// ---- Chapters (new chapter) — no wiki write -------------------------------

/** An empty ProseMirror doc (one empty paragraph) for a fresh chapter body. */
const EMPTY_CHAPTER_BODY = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;

/**
 * Create a new, empty chapter appended after the last one. Not a wiki write, so
 * no confirmation token is needed. Returns the new chapter number so the client
 * can navigate to it (?chapter=<n>).
 */
export async function createChapter(input?: {
  title?: string;
}): Promise<ActionResult<{ number: number }>> {
  try {
    const number = await getNextChapterNumber();
    const title = input?.title?.trim() || "Untitled";
    await insertChapter({
      id: randomUUID(),
      number,
      title,
      body: EMPTY_CHAPTER_BODY,
    });
    return { ok: true, data: { number } };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

// ---- Marks ----------------------------------------------------------------

/**
 * Open a mark's inline note (one open at a time). Read-only UI state; clicking
 * a rail row and clicking the underline are the same action (§8). Mirrors
 * reducer action `OPEN_MARK`.
 */
export async function openMark(markKey: string): Promise<ActionResult> {
  void markKey;
  // No persistence: open-mark is session state. Server action kept for uniform pairing.
  return { ok: true, data: undefined };
}

/**
 * Resolve a mark via one of its note actions. The three actions differ in
 * production (§8) and are dispatched on `actionId`:
 *   - 'leave' → persist markKey in resolved_marks (suppress permanently).
 *   - 'text'  → return selectForEdit; the editor selects the run. No DB write.
 *   - 'wiki'  → return needsConfirmation; the UI routes into the confirmed
 *               wiki path. resolveMark never writes the wiki itself.
 *
 * Mirrors reducer action `RESOLVE_MARK`. Signature: resolveMark(markId, actionId).
 */
/**
 * Context the client supplies alongside the markKey. `resolveMark(markId,
 * actionId)` keeps its documented primary shape; `context` carries the
 * mark-derived data the server can't recover from a markKey alone (the quote to
 * select, or the entry/fact a 'wiki' correction would touch). Optional so the
 * signature stays backward compatible.
 */
export interface ResolveMarkContext {
  quote?: string;
  entryId?: string;
  factKey?: string;
}

export async function resolveMark(
  markId: string,
  actionId: MarkActionId,
  context: ResolveMarkContext = {},
): Promise<ActionResult<ResolveMarkOutcome>> {
  try {
    switch (actionId) {
      case "leave":
        // The ONLY DB write here: suppress this mark permanently by its stable
        // key, so it stays resolved across reloads even after the paragraph moves.
        await upsertResolvedMark({
          markKey: markId,
          resolution: "leave",
          resolvedAt: Date.now(),
        });
        return { ok: true, data: { kind: "resolved", markKey: markId } };

      case "text":
        // No DB write: the editor selects the run so the author can rewrite it.
        return {
          ok: true,
          data: { kind: "selectForEdit", quote: context.quote ?? "" },
        };

      case "wiki":
        // No wiki write here (product rule 1). Hand off to the confirmed wiki
        // path; the UI opens the confirmation flow keyed by entry + fact.
        return {
          ok: true,
          data: {
            kind: "needsConfirmation",
            entryId: context.entryId ?? "",
            factKey: context.factKey ?? "",
          },
        };
    }
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

// ---- AI: grounded mark explanation (read-only, NOT a wiki write) -----------
//
// When the engine flags a run, the writer can ask the AI to explain WHY it
// clashes with their world and offer an optional rewrite. This is purely
// advisory: it grounds on the wiki snapshot, writes NOTHING, and never touches
// the manuscript. The engine remains the source of truth — with AI off the
// note still shows the engine's own noteText + actions, unchanged.

/** True when the AI gateway is configured (for UI gating on the write screen). */
export async function isWriteAiEnabled(): Promise<boolean> {
  return aiEnabled();
}

interface AiMarkAdvice {
  explanation?: string;
  rewrite?: string;
}

export async function explainMark(input: {
  quote: string;
  kind: "conflict" | "missing" | string;
  noteText: string;
  paragraph?: string;
}): Promise<ActionResult<{ explanation: string; rewrite: string }>> {
  const quote = input.quote.trim();
  if (!quote) return { ok: false, error: "No text to explain." };
  if (!aiEnabled()) {
    return {
      ok: false,
      error: "AI is not configured. Add SAAROUTERS_API_KEY to .env.local.",
    };
  }

  try {
    // Ground on the wiki so the explanation stays inside the writer's world.
    const wiki = await loadWikiSnapshot();
    const gazetteer = wiki.entries
      .map((e) => {
        const facts = e.facts.map((f) => `${f.key}: ${f.value}`).join("; ");
        return `- ${e.name} (${e.kind})${e.summary ? ` — ${e.summary}` : ""}${facts ? ` [${facts}]` : ""}`;
      })
      .join("\n");

    const isConflict = input.kind === "conflict";
    const system = [
      "You are a story-consistency collaborator for a fiction writer.",
      "The writer's consistency engine has flagged a run of their manuscript.",
      isConflict
        ? "It CONTRADICTS an established fact in their gazetteer."
        : "It introduces a detail NOT yet recorded in their gazetteer.",
      "Ground ONLY in the gazetteer provided; never invent contradicting facts.",
      "Explain the clash in 1-3 plain sentences, then offer ONE optional rewrite of the flagged run that would fit their world. If no rewrite is warranted, return an empty rewrite.",
      "Return STRICT JSON only, no prose outside JSON, shaped exactly as:",
      '{"explanation": string, "rewrite": string}',
    ].join("\n");

    const user = [
      gazetteer ? `Gazetteer (the writer's wiki):\n${gazetteer}` : "Gazetteer: (empty)",
      "",
      `Engine note: ${input.noteText}`,
      input.paragraph ? `Paragraph: ${input.paragraph}` : "",
      `Flagged run: "${quote}"`,
    ]
      .filter(Boolean)
      .join("\n");

    let advice: AiMarkAdvice;
    try {
      advice = await completeJson<AiMarkAdvice>({
        system,
        messages: [{ role: "user", content: user }],
        maxTokens: 500,
        temperature: 0.5,
      });
    } catch {
      // Fallback: plain-text explanation, no rewrite.
      const explanation = await complete({
        system:
          "You are a story-consistency collaborator. Explain in 1-3 sentences why the flagged run clashes with the writer's world.",
        messages: [{ role: "user", content: user }],
        maxTokens: 300,
        temperature: 0.5,
      });
      advice = { explanation, rewrite: "" };
    }

    return {
      ok: true,
      data: {
        explanation: (advice.explanation ?? "").trim() || "No explanation available.",
        rewrite: (advice.rewrite ?? "").trim(),
      },
    };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}
