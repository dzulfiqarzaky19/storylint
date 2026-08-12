// =============================================================================
// resolveForEntry (TCK-021) — PURE, no db, no AI.
//
// The research AI may tag a card with `forEntry`: the EXACT name of an existing
// wiki entry the card is ABOUT (a trait/curse/fact of that entry). This resolves
// that AI-named name to the single LIVE entry it names, in the SAME
// EnrichRecommendation shape recommendEnrichTarget returns — so the confirm
// strip's "Add to <entry>" path is reused unchanged. It is the high-confidence,
// AI-explicit sibling of recommendEnrichTarget: where that matcher GUESSES a
// target from the card title (exact/substring), this HONORS the AI's explicit
// pick and therefore matches by EXACT name only (case-insensitive, trimmed).
// Substring guessing stays recommendEnrichTarget's job as the fallback; doing it
// here too would re-introduce the ambiguity forEntry exists to remove.
//
// Soft-deleted entries (deletedAt != null) are EXCLUDED: a card can never route
// onto a tombstoned entry. A blank/absent hint, or a name that matches no live
// entry, returns null — the caller then falls back to recommendEnrichTarget.
// =============================================================================

import type {
  EnrichCandidate,
  EnrichRecommendation,
} from "./recommendEnrichTarget";
import { recommendEnrichTarget } from "./recommendEnrichTarget";

/**
 * Resolve an AI-named `forEntry` to the LIVE entry it exactly names, or null.
 * @param forEntry the AI's explicit target name (undefined/blank -> null).
 * @param liveEntries candidate entries; soft-deleted ones are ignored.
 */
export function resolveForEntry(
  forEntry: string | undefined,
  liveEntries: EnrichCandidate[],
): EnrichRecommendation | null {
  const wanted = (forEntry ?? "").trim().toLowerCase();
  if (!wanted) return null;

  for (const entry of liveEntries) {
    // Never route onto a soft-deleted (tombstoned) entry.
    if (entry.deletedAt != null) continue;

    const name = entry.name.trim().toLowerCase();
    if (!name) continue;

    // EXACT match only (case-insensitive) — forEntry is the AI's explicit pick,
    // not a fuzzy guess.
    if (name === wanted) {
      return { entryId: entry.id, name: entry.name };
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// routeEnrichTarget (TCK-021) — the PRECEDENCE rule, extracted pure so it is
// unit-testable in node (the ResearchScreen useMemo that consumes it lives in a
// .tsx the node test env can't load). The AI's EXPLICIT pick wins: if `forEntry`
// resolves to a live entry, route there; otherwise fall back to the
// title-guessing recommender. Both branches yield the same EnrichRecommendation
// shape, so the confirm strip's "Add to <entry>" path is reused unchanged.
// -----------------------------------------------------------------------------
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
