"use server";

import { upsertChapterCheckCache } from "@/server/db/chapters/mutations";
import { aiEnabled } from "../../ai/saarouters";
import { AI_OFF, askGroundedJson } from "../../ai/groundedAsk";
import { loadWikiSnapshot } from "@/server/db/gazetteer/snapshots";
import { getChapter } from "@/server/db/chapters/queries";
import { type Mark } from "@/domain/check";
import { type AiCheckResponse, aiResultToMarks } from "@/domain/check/ai";
import { findRetrievalMisses, selectGazetteer } from "@/domain/check/retrieval";
import { hashValue } from "@/domain/check/hash";
import { type ActionResult, runActionBare } from "@/domain/result";

interface AiMarkAdvice {
  explanation?: string;
  rewrite?: string;
}

export async function explainMark(input: {
  quote: string;
  kind: "conflict" | "missing" | string;
  noteText: string;
  paragraph?: string;
  sentence?: string;
  entityId?: string;
  universeId: string;
}): Promise<ActionResult<{ explanation: string; rewrite: string }>> {
  const quote = input.quote.trim();
  if (!quote) return { ok: false, error: "No text to explain." };
  if (!aiEnabled()) return { ok: false, error: AI_OFF };

  return runActionBare(async () => {
    const wiki = await loadWikiSnapshot(input.universeId);
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

interface AiCheckInput {
  universeId: string;
  paragraphs: string[];
  changedIndices?: number[];
  resolvedMarkKeys?: string[];
}

export async function aiCheckChapter(
  input: AiCheckInput,
): Promise<ActionResult<{ marks: Mark[] }>> {
  if (!aiEnabled()) return { ok: false, error: AI_OFF };

  const paragraphs = input.paragraphs ?? [];
  const indices =
    input.changedIndices && input.changedIndices.length > 0
      ? [...new Set(input.changedIndices)].filter(
          (i) => i >= 0 && i < paragraphs.length,
        )
      : paragraphs.map((_, i) => i);

  if (indices.length === 0) return { ok: true, data: { marks: [] } };

  return runActionBare(async () => {
    const wiki = await loadWikiSnapshot(input.universeId);
    const sentText = indices.map((i) => paragraphs[i]).join("\n\n");
    const selection = selectGazetteer(wiki, { text: sentText });

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
    const wiki = await loadWikiSnapshot(input.universeId);
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
