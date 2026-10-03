"use server";

import { type ActionResult, runAction } from "@/domain/result";
import { aiEnabled } from "../../ai/saarouters";
import { AI_OFF, askGroundedJson } from "../../ai/groundedAsk";
import { loadWikiSnapshot } from "@/server/db/gazetteer/snapshots";
import { getEntryUniverseId } from "@/server/db/gazetteer/reads";

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
  if (!aiEnabled()) return { ok: false, error: AI_OFF };
  return runAction("wiki.suggestEntryFacts", async () => {
    const universeId = await getEntryUniverseId(input.entryId);
    if (!universeId) return { ok: false, error: `Unknown entry: ${input.entryId}` };
    const wiki = await loadWikiSnapshot(universeId);
    const entry = wiki.byId[input.entryId];
    if (!entry) return { ok: false, error: `Unknown entry: ${input.entryId}` };

    const existing = entry.facts.map((f) => `${f.key}: ${f.value}`).join("; ");
    const world = wiki.entries
      .filter((e) => e.id !== entry.id)
      .slice(0, 40)
      .map((e) => ({ id: e.id, name: e.name, kind: e.kind, summary: e.summary, facts: [] }));

    const system: string[] = [
      "You help a fiction writer flesh out their own story wiki (gazetteer).",
      "Given one entry and the surrounding world, propose 3-5 SHORT candidate details (facts) that are consistent with what already exists.",
      "Never contradict existing facts. Prefer concrete, gazetteer-style details (e.g. Eyes: Grey, Allegiance: Quiet Sept).",
      "Do NOT repeat details the entry already has.",
      'Return STRICT JSON only: {"facts": [{"key": string, "value": string}]}. key <= 3 words, value <= 8 words.',
    ];

    const asked = await askGroundedJson<AiFactsResponse>({
      system,
      user: [
        `Entry: ${entry.name} (${entry.kind})`,
        entry.summary ? `Summary: ${entry.summary}` : false,
        existing ? `Existing details: ${existing}` : "Existing details: (none)",
        { heading: "Elsewhere in the world:", entries: world, whenEmpty: "" },
      ],
      budget: "standard",
      temperature: 0.6,
    });
    if (!asked.ok) return { ok: false, error: asked.error };
    const res = asked.data;

    const existingKeys = new Set(entry.facts.map((f) => f.key.trim().toLowerCase()));
    const facts = (res.facts ?? [])
      .filter((f) => f && f.key && f.value)
      .map((f) => ({ key: f.key.trim(), value: f.value.trim() }))
      .filter((f) => !existingKeys.has(f.key.toLowerCase()))
      .slice(0, 5);

    return { ok: true, data: { facts } };
  });
}

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
