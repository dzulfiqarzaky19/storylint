import { describe, it, expect } from "vitest";
import { deriveThreadTitle } from "@/lib/research/title";

// -----------------------------------------------------------------------------
// F2a — auto-title derivation (pure). After the first user turn, if a thread's
// title is still empty or the placeholder "New thread", we derive a title from
// the writer's first question. This is the PURE core of that rule, unit-tested
// and mutation-proven in isolation; the DB UPDATE + "only when empty/New thread"
// gate live in the mutation/action layer (integration-tested separately).
//
// Rule (spec §F2a): trim the question to ~6 words / <= 48 chars, single-spaced,
// no trailing punctuation, with an ellipsis when truncated.
// -----------------------------------------------------------------------------

describe("deriveThreadTitle", () => {
  it("keeps a short question as-is (no truncation, no ellipsis)", () => {
    expect(deriveThreadTitle("Who is collecting the debt?")).toBe(
      "Who is collecting the debt",
    );
  });

  it("truncates to the first 6 words and appends an ellipsis", () => {
    // 8 words in -> first 6 kept, ellipsis marks the cut.
    expect(
      deriveThreadTitle("why does the salt name bind a family forever"),
    ).toBe("why does the salt name bind…");
  });

  it("caps the length at 48 characters (word-count high but chars over cap)", () => {
    // Six very long words would blow past 48 chars; the char cap wins.
    const q = "constantinople antidisestablishment pseudopseudohypoparathyroidism a b c";
    const out = deriveThreadTitle(q);
    expect(out.endsWith("…")).toBe(true);
    // The visible text (minus the ellipsis) never exceeds the 48-char cap.
    expect(out.replace(/…$/, "").length).toBeLessThanOrEqual(48);
  });

  it("collapses internal whitespace and trims the ends", () => {
    expect(deriveThreadTitle("  who   is\tcollecting  ")).toBe("who is collecting");
  });

  it("strips trailing punctuation from the derived title", () => {
    expect(deriveThreadTitle("what does it cost her?!")).toBe("what does it cost her");
  });

  it("falls back to 'New thread' for an empty or whitespace-only question", () => {
    expect(deriveThreadTitle("")).toBe("New thread");
    expect(deriveThreadTitle("   \t  ")).toBe("New thread");
  });
});
