import { describe, it, expect } from "vitest";
import { resolveForEntry, routeEnrichTarget } from "@/lib/research/resolveForEntry";
import type { EnrichCandidate } from "@/lib/research/recommendEnrichTarget";
import { recommendEnrichTarget } from "@/lib/research/recommendEnrichTarget";

// TCK-021: the research AI may name an EXISTING entry (`forEntry`) that a
// trait/curse/fact card is ABOUT, so the card enriches that entry instead of
// minting a duplicate. resolveForEntry turns that AI-named name into the same
// EnrichRecommendation shape recommendEnrichTarget returns, so the confirm
// strip's "Add to <entry>" path is reused unchanged. Matching is EXACT
// (case-insensitive) ONLY — substring guessing is recommendEnrichTarget's job
// as the fallback; forEntry is the AI's explicit, high-confidence choice.
const live: EnrichCandidate[] = [
  { id: "e-mc", name: "Harry", kind: "character" },
  { id: "e-bro", name: "Harry's brother Harold", kind: "character" },
  { id: "e-tower", name: "The Tower", kind: "world" },
  { id: "e-gone", name: "Ghost", kind: "lore", deletedAt: 123 },
];

describe("resolveForEntry", () => {
  it("returns the exact-name match as an EnrichRecommendation (M1)", () => {
    expect(resolveForEntry("Harry", live)).toEqual({
      entryId: "e-mc",
      name: "Harry",
    });
  });

  it("matches case-insensitively (M1)", () => {
    expect(resolveForEntry("the tower", live)).toEqual({
      entryId: "e-tower",
      name: "The Tower",
    });
    expect(resolveForEntry("  HARRY  ", live)).toEqual({
      entryId: "e-mc",
      name: "Harry",
    });
  });

  it("does NOT substring-match; a partial name is a miss (M1 exactness)", () => {
    // "Harry" is a substring of "Harry's brother Harold" but forEntry is exact:
    // the bare name resolves to the exact entry, never the longer sibling.
    expect(resolveForEntry("Harold", live)).toBeNull();
    expect(resolveForEntry("Har", live)).toBeNull();
  });

  it("skips a soft-deleted (tombstoned) target -> null (M2)", () => {
    expect(resolveForEntry("Ghost", live)).toBeNull();
  });

  it("returns null when forEntry names no live entry (M3)", () => {
    expect(resolveForEntry("Nonexistent", live)).toBeNull();
  });

  it("returns null for a missing/blank forEntry hint", () => {
    expect(resolveForEntry(undefined, live)).toBeNull();
    expect(resolveForEntry("", live)).toBeNull();
    expect(resolveForEntry("   ", live)).toBeNull();
  });
});

describe("routeEnrichTarget (M4 precedence)", () => {
  // Divergent fixture: the card TITLE "The Tower" would make the title-guessing
  // recommender pick e-tower, but the AI's explicit forEntry names "Harry"
  // (e-mc). These MUST resolve to different entries so precedence is observable.
  it("forEntry WINS over the title-guess recommender when it matches (M4)", () => {
    const card = { forEntry: "Harry", title: "The Tower", body: "" };
    // Sanity: the two paths genuinely diverge on this fixture.
    expect(recommendEnrichTarget({ title: card.title, body: card.body }, live)).toEqual({
      entryId: "e-tower",
      name: "The Tower",
    });
    // The explicit AI pick wins.
    expect(routeEnrichTarget(card, live)).toEqual({ entryId: "e-mc", name: "Harry" });
  });

  it("falls back to the recommender when forEntry is blank (M4)", () => {
    expect(routeEnrichTarget({ forEntry: "", title: "The Tower", body: "" }, live)).toEqual({
      entryId: "e-tower",
      name: "The Tower",
    });
    expect(
      routeEnrichTarget({ forEntry: undefined, title: "The Tower", body: "" }, live),
    ).toEqual({ entryId: "e-tower", name: "The Tower" });
  });

  it("falls back to the recommender when forEntry names no live entry (M4)", () => {
    // forEntry is a miss (Ghost is tombstoned / Nonexistent absent) -> title guess.
    expect(
      routeEnrichTarget({ forEntry: "Nonexistent", title: "The Tower", body: "" }, live),
    ).toEqual({ entryId: "e-tower", name: "The Tower" });
  });

  it("returns null when neither forEntry nor the title matches (M4)", () => {
    expect(
      routeEnrichTarget({ forEntry: "Nonexistent", title: "Zzz nothing", body: "" }, live),
    ).toBeNull();
  });
});
