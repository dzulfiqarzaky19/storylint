// =============================================================================
// synthesizeResolvedTarget — PURE. Builds the modal's `ResolvedTarget` DEFAULT
// for /research, where there is no check `Mark` to read one off. The modal is
// producer-agnostic (it only consumes a ResolvedTarget); on /write a real Mark
// supplies it, on /research we synthesize the same shape from the proposition
// plus the existing F6 enrich recommendation.
//
// The default mirrors exactly what the old confirmation strip decided:
//   - category  = the proposition's kind (built-in category id == kind string)
//   - entry     = the recommended existing entry (ENRICH) when F6 matched one,
//                 else a propose-by-name mint (id-XOR-proposeName, never both)
//   - fact      = {key: title, value: body} — the enrich path writes name->key,
//                 summary->value, so title/body seed the detail the writer edits
//
// checkedAgainst is intentionally NOT synthesized: a research proposal is checked
// against nothing (it proposes, it does not compare to a recorded fact), so the
// modal shows no provenance line on /research. On /write the Mark carries a real
// checkedAgainst.
// =============================================================================

import type { ResolvedTarget } from "@/lib/check";

const VALID_KINDS = ["character", "world", "organization", "lore"] as const;

/** The proposition fields the default is derived from. */
export interface PropositionSeed {
  title: string;
  body: string;
  asKind: string;
}

/** The F6 recommendation, or null when nothing confidently matched. */
export interface EnrichRecommendationSeed {
  entryId: string;
  name: string;
}

/** kind (== built-in category id) an unknown asKind falls back to `lore`. */
function toKind(asKind: string): string {
  return (VALID_KINDS as readonly string[]).includes(asKind) ? asKind : "lore";
}

/**
 * Synthesize the modal default. When a recommendation exists the entry defaults
 * to ENRICHING it (entry.id set, no proposeName); otherwise it defaults to a
 * MINT proposed by the card's title (entry.proposeName + proposeKind, no id) —
 * the id-XOR-proposeName invariant the modal and confirmCard both rely on.
 */
export function synthesizeResolvedTarget(
  card: PropositionSeed,
  recommendation: EnrichRecommendationSeed | null,
): ResolvedTarget {
  const kind = toKind(card.asKind);
  const entry: ResolvedTarget["entry"] = recommendation
    ? { id: recommendation.entryId }
    : { proposeName: card.title, proposeKind: kind };
  return {
    category: { id: kind },
    entry,
    fact: { key: card.title, value: card.body },
  };
}
