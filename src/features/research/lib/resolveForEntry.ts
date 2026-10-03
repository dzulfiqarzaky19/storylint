import type {
  EnrichCandidate,
  EnrichRecommendation,
} from "@/domain/research/recommendEnrichTarget";
import { recommendEnrichTarget } from "@/domain/research/recommendEnrichTarget";

export function resolveForEntry(
  forEntry: string | undefined,
  liveEntries: EnrichCandidate[],
): EnrichRecommendation | null {
  const wanted = (forEntry ?? "").trim().toLowerCase();
  if (!wanted) return null;

  for (const entry of liveEntries) {
    if (entry.deletedAt != null) continue;

    const name = entry.name.trim().toLowerCase();
    if (!name) continue;

    if (name === wanted) {
      return { entryId: entry.id, name: entry.name };
    }
  }

  return null;
}

export function routeEnrichTarget(
  card: { forEntry?: string; title: string; body: string },
  liveEntries: EnrichCandidate[],
): EnrichRecommendation | null {
  return (
    resolveForEntry(card.forEntry, liveEntries) ??
    recommendEnrichTarget(
      { title: card.title, body: card.body },
      liveEntries,
    )
  );
}
