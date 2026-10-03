import type { ResolvedTarget } from "@/domain/check";

const VALID_KINDS = ["character", "world", "organization", "lore"] as const;

export interface PropositionSeed {
  title: string;
  body: string;
  asKind: string;
}

export interface EnrichRecommendationSeed {
  entryId: string;
  name: string;
}

function toKind(asKind: string): string {
  return (VALID_KINDS as readonly string[]).includes(asKind) ? asKind : "lore";
}

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
