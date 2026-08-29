"use server";

// =============================================================================
// Write Server Actions
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
  replacePhraseMentions,
  upsertResolvedMark,
  insertChapter,
  getNextChapterNumber,
  renameChapter as renameChapterRow,
  deleteChapter as deleteChapterRow,
  countChaptersInBook,
  upsertChapterCheckCache,
} from "../db/mutations";
import { randomUUID } from "node:crypto";
import { completeJson, aiEnabled } from "../ai/saarouters";
import { loadWikiSnapshot } from "../db/gazetteer";
import { getChapter, listChapters } from "../db/chapter-queries";
import { docToParagraphs } from "../write/adapters";
import { extractCandidatePhrases } from "../check/unrecorded";
import type { Mark } from "../check";
import { aiResultToMarks, type AiCheckResponse } from "../check/ai";
import { selectGazetteer, findRetrievalMisses } from "../check/retrieval";
import { hashValue } from "../check/hash";

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
    // The writer's prose is the sacred write. saveChapterBody is the ONLY thing
    // in this try whose failure returns ok:false — a body-save error MUST reach
    // the user (§8), never a green ack over lost work.
    await saveChapterBody({ number: input.chapterNumber, body: input.body });

    // Tier 2: refresh this chapter's rows in the book-wide phrase index so
    // cross-chapter recurrence ranking stays current. This is RANK data only:
    // importanceOf reads it to rank an unrecorded mark high-vs-normal, but it
    // NEVER gates WHAT is flagged (unrecorded.ts). So the index refresh is
    // BEST-EFFORT and runs in its OWN try: if it fails, the body is already
    // saved and the writer keeps their words. We do NOT put it in the same
    // transaction as the body — that would convert a cosmetic stale-rank into
    // DATA LOSS (a failed side-table write would block saving prose). Instead we
    // log LOUDLY (error level, naming the chapter) so a systematic index failure
    // screams in our server logs rather than hiding as silent staleness.
    try {
      const phrases = extractCandidatePhrases(docToParagraphs(input.body));
      await replacePhraseMentions({ chapterNumber: input.chapterNumber, phrases });
    } catch (indexErr) {
      console.error(`saveManuscript: phrase-index refresh failed for chapter ${input.chapterNumber} (body saved; cross-chapter rank may be stale): ${messageOf(indexErr)}`);
    }

    return { ok: true, data: undefined };
  } catch (err) {
    // Surface, don't swallow (§8): a failed BODY save must reach the user.
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
  bookId?: string;
}): Promise<ActionResult<{ number: number }>> {
  try {
    // Book scope: numbering and insertion must target the active book, or
    // "+ New chapter" on a freshly created book lands the row in
    // DEFAULT_BOOK_ID and the new book never grows past its seeded Chapter One.
    const number = await getNextChapterNumber(input?.bookId);
    const title = input?.title?.trim() || "Untitled";
    await insertChapter({
      id: randomUUID(),
      number,
      title,
      body: EMPTY_CHAPTER_BODY,
      bookId: input?.bookId,
    });
    return { ok: true, data: { number } };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

// ---- Chapters (rename / delete) — no wiki write ---------------------------

/** Rename a chapter's title within its book. Not a wiki write. */
export async function renameChapter(input: {
  number: number;
  title: string;
  bookId?: string;
}): Promise<ActionResult<{ number: number; title: string }>> {
  try {
    const title = input.title.trim();
    if (!title) return { ok: false, error: "A chapter needs a title." };
    await renameChapterRow({ number: input.number, title, bookId: input.bookId });
    return { ok: true, data: { number: input.number, title } };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

/**
 * Delete a chapter from its book. Guarded: a book must keep at least one
 * chapter, so deleting the last one is refused (the UI also disables the
 * affordance, but the server enforces the invariant so no client can break it).
 * Returns the surviving chapter to navigate to — the nearest lower number, else
 * the new lowest — so the caller lands the writer somewhere real. Not a wiki write.
 */
export async function deleteChapter(input: {
  number: number;
  bookId?: string;
}): Promise<ActionResult<{ next: number }>> {
  try {
    const remaining = await countChaptersInBook(input.bookId);
    if (remaining <= 1) {
      return { ok: false, error: "A book must keep at least one chapter." };
    }
    const res = await deleteChapterRow({ number: input.number, bookId: input.bookId });
    if (res.deleted === 0) return { ok: false, error: "That chapter no longer exists." };
    // Land on the nearest SURVIVING chapter: prefer the previous number, else the
    // new lowest. The resolver clamps an unknown ?chapter= to the last chapter, so
    // this only needs to be a real surviving number, which the page then honors.
    const numbers = (await listChapters(input.bookId)).map((c) => c.number);
    const next =
      numbers.filter((n) => n < input.number).pop() ?? numbers[0] ?? 1;
    return { ok: true, data: { next } };
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
  /** The full sentence containing the flagged run. When provided, the rewrite
   * replaces this whole sentence (grammatical splice) instead of the sub-run. */
  sentence?: string;
  /** The wiki entry this mark is anchored to (Mark.entityId). When present it
   * pins retrieval to that exact entry instead of re-deriving it from a substring
   * scan of the local text, so the grounding is exact even for a low-frequency
   * mention. Optional: absent (e.g. AI `missing` marks) falls back to the scan. */
  entityId?: string;
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
    // SCALE (G1/G4): send only the entities this flagged run actually leans on,
    // not the whole world, so prompt cost stays flat as the wiki grows. Text
    // scanned is the flagged run + its sentence + its paragraph (all local
    // context we have). When the caller knows the anchored entry (Mark.entityId),
    // we PIN it via focusEntityIds so retrieval is exact even if the substring
    // scan would miss a low-frequency mention; the text scan still expands context.
    const retrievalText = [input.paragraph, input.sentence, quote]
      .filter(Boolean)
      .join('\n');
    const focusEntityIds = input.entityId?.trim()
      ? [input.entityId.trim()]
      : undefined;
    const selection = selectGazetteer(wiki, { text: retrievalText, focusEntityIds });
    const gazetteer = selection.entries
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
      "Explain the clash in 1-3 plain sentences.",
      // The UI splices `rewrite` in for EXACTLY the flagged run, so it must be a
      // drop-in replacement of only that run: no surrounding sentence, no quotes,
      // no leading/trailing words that already sit outside the flagged text. If a
      // clean in-place substitution is not possible, return an empty rewrite.
      // With a sentence in hand the UI replaces the WHOLE sentence, so ask for a
      // complete grammatical sentence; otherwise fall back to a sub-run rewrite.
      input.sentence
        ? `Then rewrite the ENTIRE sentence below so it no longer clashes, keeping the author\u2019s voice and every other fact intact, and return the full rewritten sentence as \`rewrite\`.\nSentence: "${input.sentence.trim()}"`
        : "Then offer ONE optional rewrite that REPLACES ONLY the flagged run in place. It must read grammatically when substituted verbatim for the flagged run and repeat none of the words around it. If no clean in-place rewrite fits, return an empty rewrite.",
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
      });
    } catch {
      // SCALE (G5): the JSON call already failed and BILLED. A second full AI
      // call here (same large grounded prompt) double-bills for a strictly worse
      // result. Degrade for FREE to the engine's own note instead: the
      // deterministic engine is the source of truth and its noteText already
      // explains the clash. No rewrite is offered on the fallback (that needed
      // the model).
      advice = { explanation: input.noteText, rewrite: "" };
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


// ---- AI: whole-chapter consistency check (grounded, NOT a wiki write) ------
//
// This is the general, reasoning-based half of the write-page check. The
// deterministic engine (checkManuscript) gives instant squiggles for the few
// patterns it knows; this action asks the AI to cross-check ARBITRARY factual
// claims in the manuscript against the writer's full gazetteer and return
// contradictions + unrecorded facts. It is invoked on save, and only the
// changed paragraphs are sent (cost control). It writes NOTHING: findings map
// to the same Mark shape and route through resolveMark's confirmation path, so
// PRODUCT RULE 1 holds — AI proposes, the writer confirms, nothing auto-enters
// the wiki.

interface AiCheckInput {
  /** The FULL current manuscript paragraphs (for grounding + positions). */
  paragraphs: string[];
  /** Indices of paragraphs that changed since the last pass; omit/empty = all. */
  changedIndices?: number[];
  /** markKeys the writer already resolved; their marks are suppressed. */
  resolvedMarkKeys?: string[];
}

export async function aiCheckChapter(
  input: AiCheckInput,
): Promise<ActionResult<{ marks: Mark[] }>> {
  if (!aiEnabled()) {
    return { ok: false, error: "AI is not configured. Add SAAROUTERS_API_KEY to .env.local." };
  }

  const paragraphs = input.paragraphs ?? [];
  // Which paragraphs to actually send. Empty changedIndices => check all.
  const indices =
    input.changedIndices && input.changedIndices.length > 0
      ? [...new Set(input.changedIndices)].filter(
          (i) => i >= 0 && i < paragraphs.length,
        )
      : paragraphs.map((_, i) => i);

  if (indices.length === 0) return { ok: true, data: { marks: [] } };

  try {
    const wiki = await loadWikiSnapshot();
    // SCALE (G1/G4): retrieve only the entities the SENT paragraphs lean on so
    // the prompt cost stays flat as the wiki grows, instead of inlining the whole
    // world. We scan exactly the paragraphs we send (the changed set), not the
    // full manuscript, so retrieval tracks what the model actually sees.
    const sentText = indices.map((i) => paragraphs[i]).join("\n\n");
    const selection = selectGazetteer(wiki, { text: sentText });
    const gazetteer = selection.entries
      .map((e) => {
        const facts = e.facts.map((f) => `${f.key}: ${f.value}`).join("; ");
        return `- [${e.id}] ${e.name} — ${e.kind}${e.summary ? `: ${e.summary}` : ""}${facts ? ` [${facts}]` : ""}`;
      })
      .join("\n");

    // Send only the changed paragraphs, tagged with their real index so the
    // model can echo it back and we can anchor positions correctly.
    const numbered = indices
      .map((i) => `[[P${i}]] ${paragraphs[i]}`)
      .join("\n\n");

    const system = [
      "You are the consistency engine for a fiction writer. You are given the writer's GAZETTEER (their wiki of characters, places, lore and facts) and one or more MANUSCRIPT PARAGRAPHS.",
      "Cross-check every factual claim in the paragraphs against the gazetteer.",
      "Report THREE kinds of finding:",
      "  conflicts: a claim that CONTRADICTS a recorded gazetteer fact (wrong count, wrong colour, wrong age, wrong relationship, impossible per a recorded rule, etc.).",
      "  missing:   a concrete, checkable NEW fact about a KNOWN entity (one already in the gazetteer) that the gazetteer does not record yet.",
      "  For a missing finding, set entryId to the bracketed gazetteer id of that KNOWN entity, and key/value to the new fact to record.",
      "  newEntity: the prose introduces a GENUINELY NEW subject that has NO entry in the gazetteer at all — a named character, place/world, organization, or standalone piece of lore worth its own entry. Propose it for the writer to confirm; you are NOT creating it.",
      "HARD RULES:",
      "- Ground ONLY in the gazetteer. Never invent a contradicting fact. If the gazetteer does not constrain something, it is NOT a conflict.",
      "- Every quote MUST be copied VERBATIM from the paragraph text (exact characters, including punctuation). Do not paraphrase.",
      "- Prefer few, high-confidence findings over many weak ones. If unsure, omit it.",
      "- entryId must be one of the bracketed ids from the gazetteer, or empty.",
      "- On a conflict, ALSO return factKey: the exact gazetteer fact key you checked the claim against (the text before the colon inside the entry’s [key: value; ...] list, e.g. \"chair-count\"). Leave it empty if no single recorded fact applies.",
      "- On a conflict, ALSO return suggested: the CORRECTED value for that fact as the manuscript now implies it (what the gazetteer SHOULD say to match the prose, e.g. if recorded is \"four\" and the prose says five chairs, suggested is \"five\"). Keep it a short value only, no key, no prose. Leave it empty if the prose does not imply a single replacement value.",
      "- newEntity is ONLY for a subject with NO existing entry. If the subject already appears in the gazetteer, it is `missing` (a new fact about it), never `newEntity`. Never propose a newEntity that duplicates a gazetteer entry.",
      "- newEntity.kind MUST be exactly one of: character | world | organization | lore. If unsure, use lore.",
      "- newEntity.name is the proposed short display name for the entry (e.g. \"Saint Osk\").",
      "Return STRICT JSON only, no prose, shaped exactly:",
      '{"conflicts":[{"quote":string,"entryId":string,"factKey":string,"recorded":string,"suggested":string,"reason":string,"paragraph":number}],"missing":[{"quote":string,"entryId":string,"reason":string,"key":string,"value":string,"paragraph":number}],"newEntity":[{"quote":string,"name":string,"kind":string,"reason":string,"paragraph":number}]}',
    ].join("\n");

    const user = [
      `GAZETTEER:\n${gazetteer || "(empty)"}`,
      "",
      `MANUSCRIPT PARAGRAPHS (each prefixed with its index [[Pn]]):\n${numbered}`,
    ].join("\n");

    let parsed: AiCheckResponse;
    try {
      // NOTE: no `temperature`. The SaaRouters proxy returns an EMPTY completion
      // (200, stop=end_turn, 0 output tokens) when a `temperature` is sent with a
      // larger prompt like this one. Omitting it makes the gateway reliably return
      // JSON. Verified live 2026-08-09: with temperature 0.2 -> empty; without -> ok.
      parsed = await completeJson<AiCheckResponse>({
        system,
        messages: [{ role: "user", content: user }],
        maxTokens: 900,
      });
    } catch (err) {
      return { ok: false, error: messageOf(err) };
    }

    // SCALE (M5): retrieval can create SILENT false-negatives. If the model
    // echoes an entryId that was NOT in the pruned gazetteer we sent, retrieval
    // under-selected: it referenced an entity we did not ground on, so a
    // contradiction against that entity could be missed. This is invisible in
    // production, so in DEV ONLY we log it to tune maxEntries and the pin layers.
    // Pure diagnostic: it changes NO marks and NO product behavior.
    if (process.env.NODE_ENV !== "production") {
      const misses = findRetrievalMisses(
        (parsed.conflicts ?? []).map((c) => (c.entryId ?? "").replace(/^\[+|\]+$/g, "")),
        selection.entries.map((e) => e.id),
      );
      if (misses.length > 0) {
        console.warn(
          `[retrieval-miss] model echoed ${misses.length} entryId(s) not in the sent gazetteer: ${misses.join(", ")}. Consider raising maxEntries or the pin layers.`,
        );
      }
    }

    // Build a preferred-index hint from the model's echoed paragraph numbers.
    const preferredIndexByQuote: Record<string, number> = {};
    for (const c of parsed.conflicts ?? []) {
      const p = (c as { paragraph?: number }).paragraph;
      if (typeof c.quote === "string" && typeof p === "number") {
        preferredIndexByQuote[c.quote.trim()] = p;
      }
    }
    for (const m of parsed.missing ?? []) {
      const p = (m as { paragraph?: number }).paragraph;
      if (typeof m.quote === "string" && typeof p === "number") {
        preferredIndexByQuote[m.quote.trim()] = p;
      }
    }

    for (const n of parsed.newEntity ?? []) {
      const p = (n as { paragraph?: number }).paragraph;
      if (typeof n.quote === "string" && typeof p === "number") {
        preferredIndexByQuote[n.quote.trim()] = p;
      }
    }

    // Server-side (entryId, factKey) -> stable factId, built from the SAME
    // gazetteer snapshot we grounded the model on. The model only ever echoes
    // the human-readable factKey; we resolve the opaque id here so checkedAgainst
    // carries a stable fact reference without trusting the model to repeat one.
    const factIdByEntryKey: Record<string, string> = {};
    for (const e of selection.entries) {
      for (const f of e.facts) {
        factIdByEntryKey[`${e.id}\u0000${f.key}`] = f.id;
      }
    }

    const resolved = new Set(input.resolvedMarkKeys ?? []);
    const marks = aiResultToMarks(parsed, paragraphs, {
      preferredIndexByQuote,
      factIdByEntryKey,
    }).filter((mk) => !resolved.has(mk.markKey));

    return { ok: true, data: { marks } };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

// ---- T-AICACHE: persist the AI cross-check result for a chapter -----------

/**
 * Persist the reconciled AI marks for a chapter so a later open rehydrates the
 * Write rail instantly instead of re-firing the (network) AI call. The client
 * calls this after a SUCCESSFUL runAiCheck reconcile, passing the FULL current
 * body + the reconciled full mark set + the active scope. The server computes
 * the invalidation hashes (bodyHash over the body, wikiHash over the wiki
 * snapshot the AI grounds in) so both sides use the identical hash function, and
 * resolves the chapter row id from (chapterNumber, bookId). A missing chapter is
 * a silent no-op (nothing to cache); it never throws into the editor. Never
 * writes the wiki.
 */
export async function persistChapterCheck(input: {
  chapterNumber: number;
  universeId: string;
  bookId: string;
  body: unknown;
  marks: Mark[];
}): Promise<ActionResult<{ cached: boolean }>> {
  try {
    const chapter = await getChapter(input.chapterNumber, input.bookId);
    if (!chapter) return { ok: true, data: { cached: false } };
    const wiki = await loadWikiSnapshot(input.universeId, input.bookId);
    await upsertChapterCheckCache({
      chapterId: chapter.id,
      bodyHash: hashValue(input.body),
      wikiHash: hashValue(wiki),
      marks: input.marks,
      checkedAt: Date.now(),
    });
    return { ok: true, data: { cached: true } };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}
