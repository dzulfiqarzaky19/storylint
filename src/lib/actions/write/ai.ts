"use server";

// ============================================================================
// Write AI server actions (mark explain / chapter check; read-only)
// Split out of the former monolithic write.ts (T-ARCH-9). runAction/runActionBare
// envelopes are unchanged; only file boundaries moved.
// ============================================================================

import { upsertChapterCheckCache } from "../../db/mutations";
import { aiEnabled } from "../../ai/saarouters";
import { AI_OFF, askGroundedJson } from "../../ai/groundedAsk";
import { loadWikiSnapshot } from "../../db/gazetteer";
import { getChapter } from "../../db/chapter-queries";
import { type Mark } from "../../check";
import { type AiCheckResponse, aiResultToMarks } from "../../check/ai";
import { findRetrievalMisses, selectGazetteer } from "../../check/retrieval";
import { hashValue } from "../../check/hash";
import { type ActionResult, runActionBare } from "../confirmation";

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
  // Bail before the snapshot load: with no gateway the fallback below would
  // silently return the engine note as if the AI had answered.
  if (!aiEnabled()) return { ok: false, error: AI_OFF };

  return runActionBare(async () => {
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

    const isConflict = input.kind === "conflict";
    const system: string[] = [
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
    ];

    const asked = await askGroundedJson<AiMarkAdvice>({
      system,
      user: [
        {
          heading: "Gazetteer (the writer's wiki):",
          entries: selection.entries,
          whenEmpty: "Gazetteer: (empty)",
        },
        `Engine note: ${input.noteText}`,
        input.paragraph ? `Paragraph: ${input.paragraph}` : false,
        `Flagged run: "${quote}"`,
      ],
      budget: "standard",
    });

    // SCALE (G5): the call already failed and BILLED. A second full AI call here
    // (same large grounded prompt) double-bills for a strictly worse result.
    // Degrade for FREE to the engine's own note instead: the deterministic
    // engine is the source of truth and its noteText already explains the clash.
    // No rewrite is offered on the fallback (that needed the model).
    const advice: AiMarkAdvice = asked.ok
      ? asked.data
      : { explanation: input.noteText, rewrite: "" };

    return {
      ok: true,
      data: {
        explanation: (advice.explanation ?? "").trim() || "No explanation available.",
        rewrite: (advice.rewrite ?? "").trim(),
      },
    };
  });
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
  if (!aiEnabled()) return { ok: false, error: AI_OFF };

  const paragraphs = input.paragraphs ?? [];
  // Which paragraphs to actually send. Empty changedIndices => check all.
  const indices =
    input.changedIndices && input.changedIndices.length > 0
      ? [...new Set(input.changedIndices)].filter(
          (i) => i >= 0 && i < paragraphs.length,
        )
      : paragraphs.map((_, i) => i);

  if (indices.length === 0) return { ok: true, data: { marks: [] } };

  return runActionBare(async () => {
    const wiki = await loadWikiSnapshot();
    // SCALE (G1/G4): retrieve only the entities the SENT paragraphs lean on so
    // the prompt cost stays flat as the wiki grows, instead of inlining the whole
    // world. We scan exactly the paragraphs we send (the changed set), not the
    // full manuscript, so retrieval tracks what the model actually sees.
    const sentText = indices.map((i) => paragraphs[i]).join("\n\n");
    const selection = selectGazetteer(wiki, { text: sentText });

    // Send only the changed paragraphs, tagged with their real index so the
    // model can echo it back and we can anchor positions correctly.
    const numbered = indices
      .map((i) => `[[P${i}]] ${paragraphs[i]}`)
      .join("\n\n");

    const system: string[] = [
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
    ];

    // `addressable` is load-bearing here and nowhere else: the response echoes an
    // entryId back, and only the bracketed form gives the model an id to echo.
    const asked = await askGroundedJson<AiCheckResponse>({
      system,
      user: [
        { heading: "GAZETTEER:", entries: selection.entries, whenEmpty: "GAZETTEER:\n(empty)", addressable: true },
        "",
        `MANUSCRIPT PARAGRAPHS (each prefixed with its index [[Pn]]):\n${numbered}`,
      ],
      budget: "full",
    });
    if (!asked.ok) return { ok: false, error: asked.error };
    const parsed = asked.data;

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
  });
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
  return runActionBare<{ cached: boolean }>(async () => {
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
  });
}
