// =============================================================================
// recommendEnrichTarget (F6-S3a) — PURE, no db, no AI.
//
// The correctness core of "enrich the existing entry, don't spawn a duplicate".
// Given a research card and the LIVE wiki entries, pick the single best existing
// entry to enrich, or null when nothing confidently matches (in which case the
// caller falls back to creating a new entry).
//
// Matching is by NAME only (case-insensitive): a card about "The Tower" should
// recommend the existing "The Tower" entry rather than minting a second one. A
// candidate matches when the card title equals its name, or contains its name as
// a substring, or is contained by its name. Among matches, the LONGEST matched
// name wins (most specific), so "The Broken Tower" beats a bare "Tower".
//
// Soft-deleted entries (deletedAt != null) are EXCLUDED: we never recommend a
// tombstoned entry as an enrich target.
// =============================================================================

export interface EnrichCandidate {
  id: string;
  name: string;
  kind: string;
  /** Set (non-null) when the entry has been soft-deleted; such entries are skipped. */
  deletedAt?: number | null;
}

export interface EnrichRecommendation {
  entryId: string;
  name: string;
}

/**
 * Best LIVE-entry match for a card, or null when no confident match exists.
 * @param card the research card being written in (only its title is matched).
 * @param liveEntries candidate entries; soft-deleted ones are ignored.
 */
export function recommendEnrichTarget(
  card: { title: string; body: string },
  liveEntries: EnrichCandidate[],
): EnrichRecommendation | null {
  const title = card.title.trim().toLowerCase();
  if (!title) return null;

  let best: EnrichCandidate | null = null;
  for (const entry of liveEntries) {
    // Never recommend a soft-deleted (tombstoned) entry.
    if (entry.deletedAt != null) continue;

    const name = entry.name.trim().toLowerCase();
    if (!name) continue;

    const matches = title === name || title.includes(name) || name.includes(title);
    if (!matches) continue;

    // Prefer the most specific (longest) matched name.
    if (best === null || entry.name.trim().length > best.name.trim().length) {
      best = entry;
    }
  }

  if (best === null) return null;
  return { entryId: best.id, name: best.name };
}
