"use server";

// ============================================================================
// Wiki AI-suggestion server actions (read-only)
// Split out of the former monolithic wiki.ts (T-ARCH-7). Product rule 1 and the
// runAction envelope are unchanged; only file boundaries moved.
// ============================================================================

import { type ActionResult, runAction } from "../confirmation";
import { aiEnabled, completeJson } from "../../ai/saarouters";
import { loadWikiSnapshot } from "../../db/gazetteer";
import { type CascadeCount } from "../../db/mutations";

// Grounds on the whole gazetteer plus the focused entry and asks the model for
// candidate facts (key/value). This writes NOTHING — it only returns proposals.
// The writer turns any proposal into a real fact via createFact (the gate), so
// product rule 1 holds: nothing enters the wiki without explicit confirmation.
export interface SuggestedFact {
  key: string;
  value: string;
}

export interface SuggestedTie {
  toName: string;
  rel: string;
  citation?: string;
}

interface AiFactsResponse {
  facts?: SuggestedFact[];
}

export async function suggestEntryFacts(input: {
  entryId: string;
}): Promise<ActionResult<{ facts: SuggestedFact[] }>> {
  if (!aiEnabled()) {
    return { ok: false, error: "AI is not configured. Add SAAROUTERS_API_KEY to .env.local." };
  }
  return runAction("wiki.suggestEntryFacts", async () => {
    const wiki = await loadWikiSnapshot();
    const entry = wiki.byId[input.entryId];
    if (!entry) return { ok: false, error: `Unknown entry: ${input.entryId}` };

    const existing = entry.facts.map((f) => `${f.key}: ${f.value}`).join("; ");
    const world = wiki.entries
      .filter((e) => e.id !== entry.id)
      .slice(0, 40)
      .map((e) => `- ${e.name} (${e.kind})${e.summary ? `: ${e.summary}` : ""}`)
      .join("\n");

    const system = [
      "You help a fiction writer flesh out their own story wiki (gazetteer).",
      "Given one entry and the surrounding world, propose 3-5 SHORT candidate details (facts) that are consistent with what already exists.",
      "Never contradict existing facts. Prefer concrete, gazetteer-style details (e.g. Eyes: Grey, Allegiance: Quiet Sept).",
      "Do NOT repeat details the entry already has.",
      'Return STRICT JSON only: {"facts": [{"key": string, "value": string}]}. key <= 3 words, value <= 8 words.',
    ].join("\n");

    const user = [
      `Entry: ${entry.name} (${entry.kind})`,
      entry.summary ? `Summary: ${entry.summary}` : "",
      existing ? `Existing details: ${existing}` : "Existing details: (none)",
      "",
      world ? `Elsewhere in the world:\n${world}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await completeJson<AiFactsResponse>({
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 500,
      temperature: 0.6,
    });

    const existingKeys = new Set(entry.facts.map((f) => f.key.trim().toLowerCase()));
    const facts = (res.facts ?? [])
      .filter((f) => f && f.key && f.value)
      .map((f) => ({ key: f.key.trim(), value: f.value.trim() }))
      .filter((f) => !existingKeys.has(f.key.toLowerCase()))
      .slice(0, 5);

    return { ok: true, data: { facts } };
  });
}

// ---- World structure (F7 S5) ----------------------------------------------
//
// STRUCTURAL, NOT wiki content. Creating or deleting a universe/world/book
// shapes the world SKELETON; it never writes an entry, fact, tie, or facet, so
// product rule 1 ("nothing enters the WIKI without confirmation") does not apply
// and these actions carry NO WikiWriteConfirmation token. The DELETES are
// destructive, so — mirroring purgeExpiredDeleted — they are gated on an explicit
// `confirmed: true` (the danger modal's confirm click), and each returns the
// authoritative CascadeCount so the UI can show exactly how many rows were
// removed (count === rows-removed, by construction; see mutations.ts).

// STUB: returns one fixed suggestion. The real implementation will scan
// entry.appearances, detect entity co-occurrences, and propose a role+citation.
export async function suggestEntryTies(input: {
  entryId: string;
}): Promise<ActionResult<{ ties: SuggestedTie[] }>> {
  return {
    ok: true,
    data: { ties: [{ toName: "A returning ally", rel: "ally", citation: "ch. 7" }] },
  };
}

// ---- T-WIKI-COCKPIT-5: Overview AI synthesis (STUB) ----

// STUB: returns a fixed synopsis. The real implementation will call the AI
// gateway over entry.appearances + entry.ties + entry.facts and persist a
// writer-editable override.
export async function generateOverviewSynthesis(input: {
  entryId: string;
}): Promise<ActionResult<{ synthesis: string }>> {
  return {
    ok: true,
    data: {
      synthesis:
        "A synthesised overview will appear here. The real AI synthesis reads Timeline + Ties + Details and produces a 2-3 sentence synopsis the writer can edit.",
    },
  };
}
