/**
 * Regression: checkWiki must anchor each surviving poster suggestion to the
 * SAME entry regardless of how many earlier suggestions were dismissed.
 *
 * Bug (fixed): checkWiki zipped the dismissal-filtered `suggestions` against the
 * UNfiltered `missingMarks` by index, so dismissing the first suggestion shifted
 * every survivor onto the wrong entry (e.g. the tallow-rule suggestion, which
 * belongs to the Verge Light, re-anchored to Maren). "Write it in" would then
 * write the fact onto the wrong entry — silent data corruption.
 */

import { describe, it, expect } from "vitest";
import { checkWiki } from "@/lib/domain/wikiCheck";
import type {
  WikiSnapshot,
  EntryWithDetails,
  Shelf,
  Kind,
} from "@/lib/domain/types";

function entry(
  id: string,
  name: string,
  kind: Kind,
  shelf: Shelf,
  note: string,
): EntryWithDetails {
  return {
    id,
    kind,
    name,
    catalogueNo: "—",
    note,
    summary: "",
    shelf,
    sortOrder: 0,
    facts: [],
    ties: [],
    appearances: [],
    openQuestions: [],
    deletedAt: null,
  };
}

// Two entries the two seeded missing phrases anchor to. Notes deliberately do
// NOT contain the phrases, so the lexicon reports them as unrecorded (missing).
const maren = entry("maren", "Maren Vell", "character", "people", "The lamp-keeper.");
const vergeLight = entry(
  "vergelight",
  "Verge Light",
  "world",
  "places",
  // "tallow" must be a recorded token on this entry for the U2 (named
  // designator) pass to anchor "the tallow rule" here — the *rule* itself is
  // still unrecorded, which is what makes it a missing-suggestion.
  "A lighthouse on the verge; its lantern burns tallow.",
);

const snapshot: WikiSnapshot = {
  entries: [maren, vergeLight],
  byId: { maren, vergelight: vergeLight },
  overrides: {},
  categories: [],
};

// Paragraph text that surfaces BOTH seeded missing phrases (order: brass ring
// first, tallow rule second — matching the projection table keys Carries/Rule).
const paragraphs = [
  "She turned her mother’s brass ring on her finger and thought of the tallow rule.",
];

describe("checkWiki — suggestion anchoring is dismissal-independent", () => {
  it("keeps each survivor anchored to its own entry after a dismissal", () => {
    const base = checkWiki({
      snapshot,
      paragraphs,
      dismissedSuggestionKeys: [],
      resolvedMarkKeys: [],
    });

    // Sanity: both seeded phrases project to suggestions on the right entries.
    const carries = base.suggestions.find((s) => s.suggestionKey === "Carries");
    const rule = base.suggestions.find((s) => s.suggestionKey === "Rule");
    expect(carries, "Carries suggestion present").toBeDefined();
    expect(rule, "Rule suggestion present").toBeDefined();
    expect(carries!.entryId).toBe("maren");
    expect(rule!.entryId).toBe("vergelight");

    // Dismiss the FIRST suggestion; the survivor must NOT shift entries.
    const after = checkWiki({
      snapshot,
      paragraphs,
      dismissedSuggestionKeys: ["Carries"],
      resolvedMarkKeys: [],
    });

    const survivor = after.suggestions.find((s) => s.suggestionKey === "Rule");
    expect(survivor, "Rule suggestion survives dismissal").toBeDefined();
    expect(survivor!.entryId, "survivor stays on the Verge Light").toBe("vergelight");
    expect(after.suggestions.some((s) => s.suggestionKey === "Carries")).toBe(false);
  });
});
