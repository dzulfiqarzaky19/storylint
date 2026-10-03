export interface EnrichCandidate {
  id: string;
  name: string;
  kind: string;
  deletedAt?: number | null;
}

export interface EnrichRecommendation {
  entryId: string;
  name: string;
}

export function recommendEnrichTarget(
  card: { title: string; body: string },
  liveEntries: EnrichCandidate[],
): EnrichRecommendation | null {
  const title = card.title.trim().toLowerCase();
  if (!title) return null;

  let best: EnrichCandidate | null = null;
  for (const entry of liveEntries) {
    if (entry.deletedAt != null) continue;

    const name = entry.name.trim().toLowerCase();
    if (!name) continue;

    const matches = title === name || title.includes(name) || name.includes(title);
    if (!matches) continue;

    if (best === null || entry.name.trim().length > best.name.trim().length) {
      best = entry;
    }
  }

  if (best === null) return null;
  return { entryId: best.id, name: best.name };
}
