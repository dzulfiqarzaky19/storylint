/**
 * selectGazetteer retrieval tests (scale fix G1/G4/M4).
 *
 * Locks the load-bearing branches chick's review flagged:
 *   - exact name / fact-value match includes an entity;
 *   - 1-hop ties of pinned entities are pulled (relational backstop);
 *   - focus entities are ALWAYS included (exact anchor);
 *   - the cap is a FLOOR-PROTECTED CEILING: pinned survive, only the speculative
 *     tail is truncated, and pinned overflow RAISES the cap (never drops a real
 *     mention — importance is rank-not-gate).
 *
 * Pure test: no DB, no model. Mutation targets are called out per block.
 */
import { describe, it, expect } from "vitest";
import { selectGazetteer, findRetrievalMisses } from "@/lib/check/retrieval";
import type { EntryWithDetails, WikiSnapshot } from "@/lib/domain/types";

// ---- fixture builders -----------------------------------------------------

function entry(
  id: string,
  name: string,
  opts: {
    facts?: [string, string][];
    ties?: string[]; // toEntryIds
    note?: string;
  } = {},
): EntryWithDetails {
  return {
    id,
    kind: "character",
    name,
    catalogueNo: id.toUpperCase(),
    note: opts.note ?? "",
    summary: "",
    shelf: "people",
    sortOrder: 0,
    deletedAt: null,
    facts: (opts.facts ?? []).map(([key, value], i) => ({
      id: `${id}-f${i}`,
      entryId: id,
      key,
      value,
      fresh: false,
      sortOrder: i,
    })),
    ties: (opts.ties ?? []).map((to, i) => ({
      id: `${id}-t${i}`,
      fromEntryId: id,
      toEntryId: to,
      rel: "tied-to",
      toName: to,
      toKind: "character",
      toCatalogueNo: to.toUpperCase(),
    })),
    appearances: [],
    openQuestions: [],
  };
}

function wikiOf(entries: EntryWithDetails[]): WikiSnapshot {
  const byId: Record<string, EntryWithDetails> = {};
  for (const e of entries) byId[e.id] = e;
  return { entries, byId, overrides: {} };
}

const ids = (s: { entries: EntryWithDetails[] }) => s.entries.map((e) => e.id).sort();

// ---------------------------------------------------------------------------

describe("selectGazetteer — matching", () => {
  it("includes an entity whose NAME is an exact SUBSTRING of a larger word (NOT token-fallback)", () => {
    // Name "Ash" appears only inside the word "Ashmoor", so the normalized text
    // token is "ashmoor", NOT "ash". Token-fallback (which needs the exact token
    // "ash") therefore FAILS, and only the exact-substring branch can pin it.
    // This isolates the exact-name branch from the token fallback.
    const wiki = wikiOf([entry("ash", "Ash"), entry("bran", "Bran")]);
    // MUTATION: neuter the exact-name substring branch -> this reds (token can't save it).
    const sel = selectGazetteer(wiki, { text: "They crossed the Ashmoor before noon." });
    expect(sel.entries.map((e) => e.id)).toContain("ash");
    expect(sel.entries.map((e) => e.id)).not.toContain("bran");
  });

  it("includes an entity whose SHORT whole fact value (3 chars) appears (direct exact branch)", () => {
    // The value "orb" has no delimiter and is only 3 chars. The clause-split path
    // gates at length >= 4, so it CANNOT match "orb"; only the direct fact-value
    // branch (gated at >= 3) can pin this entity. This isolates the direct branch
    // from the clause-split branch, which have deliberately different thresholds.
    // MUTATION: neuter the direct `normText.includes(v)` return -> this reds.
    const wiki = wikiOf([
      entry("relic", "Zzz Yyy", { facts: [["form", "orb"]] }),
      entry("bran", "Bran"),
    ]);
    const sel = selectGazetteer(wiki, { text: "A cold orb lay on the altar." });
    expect(sel.entries.map((e) => e.id)).toContain("relic");
  });

  it("includes an entity when ONE clause of a multi-clause fact value appears (clause-split branch)", () => {
    // Only the second clause ("sworn at the verge") appears in the text; the full
    // value does not, so only the clause-split fact branch can pin this entity.
    // MUTATION: neuter the clause-split `normText.includes(p)` return -> this reds.
    const wiki = wikiOf([
      entry("oath", "Zzz Yyy", { facts: [["binds", "nineteen strong, sworn at the verge"]] }),
      entry("bran", "Bran"),
    ]);
    const sel = selectGazetteer(wiki, {
      text: "She had been sworn at the verge that night.",
    });
    expect(sel.entries.map((e) => e.id)).toContain("oath");
  });

  it("includes an entity by TOKEN fallback (all name tokens present, order-free)", () => {
    const wiki = wikiOf([entry("verge", "Verge Light"), entry("bran", "Bran")]);
    const sel = selectGazetteer(wiki, { text: "the light at the verge flickered" });
    expect(sel.entries.map((e) => e.id)).toContain("verge");
  });

  it("excludes an entity with no mention at all", () => {
    const wiki = wikiOf([entry("maren", "Maren"), entry("ghost", "Ghost of Elsewhere")]);
    const sel = selectGazetteer(wiki, { text: "Maren walked alone." });
    expect(sel.entries.map((e) => e.id)).toEqual(["maren"]);
  });
});

describe("selectGazetteer — ties (relational backstop)", () => {
  it("pulls the 1-hop tie of a matched entity even if the tie is not mentioned", () => {
    const wiki = wikiOf([
      entry("maren", "Maren", { ties: ["teodor"] }),
      entry("teodor", "Teodor Kest"),
      entry("bran", "Bran"),
    ]);
    // MUTATION: neuter the tie-expansion loop -> teodor drops, this reds.
    const sel = selectGazetteer(wiki, { text: "Maren said nothing of her husband." });
    expect(sel.entries.map((e) => e.id).sort()).toEqual(["maren", "teodor"]);
  });
});

describe("selectGazetteer — focus (exact anchor)", () => {
  it("ALWAYS includes focusEntityIds even with no textual mention", () => {
    const wiki = wikiOf([entry("maren", "Maren"), entry("bran", "Bran")]);
    const sel = selectGazetteer(wiki, { text: "nothing here", focusEntityIds: ["bran"] });
    // MUTATION: drop the `focus.has` pin -> bran drops, this reds.
    expect(sel.entries.map((e) => e.id)).toContain("bran");
  });
});

describe("selectGazetteer — floor-protected cap", () => {
  it("truncates only the SPECULATIVE tail, never pinned entities", () => {
    // 1 pinned (exact) + 3 token-only tail; cap=2 keeps pinned + 1 tail.
    const wiki = wikiOf([
      entry("maren", "Maren"),
      entry("verge", "Verge Light"),
      entry("hollow", "Hollow Road"),
      entry("ash", "Ash Field"),
    ]);
    const sel = selectGazetteer(wiki, {
      text: "Maren crossed the verge, the hollow, and the ash.",
      maxEntries: 2,
    });
    // maren is exact-pinned and MUST survive; total respects cap.
    expect(sel.entries.map((e) => e.id)).toContain("maren");
    expect(sel.entries.length).toBeLessThanOrEqual(2);
    expect(sel.capRaised).toBe(false);
  });

  it("RAISES the cap when pinned alone exceed maxEntries (never drops a real mention)", () => {
    // 3 exact name mentions, cap=1: all 3 must survive, capRaised=true.
    const wiki = wikiOf([
      entry("maren", "Maren"),
      entry("bran", "Bran"),
      entry("teodor", "Teodor"),
    ]);
    // MUTATION: change the pin to a ranked truncation (drop pinned past cap) -> reds.
    const sel = selectGazetteer(wiki, {
      text: "Maren, Bran, and Teodor spoke.",
      maxEntries: 1,
    });
    expect(sel.entries.map((e) => e.id).sort()).toEqual(["bran", "maren", "teodor"]);
    expect(sel.capRaised).toBe(true);
  });

  it("a single-mention heirloom is never dropped by the cap (rank-not-gate)", () => {
    // The heirloom is LAST in wiki order and mentioned once, while earlier
    // token-tail entities are mentioned. A naive `slice(0, cap)` by original order
    // would drop the heirloom; the floor-protected pin must keep it. Order matters:
    // this is what makes the test prove pin-protection, not accidental ordering.
    const wiki = wikiOf([
      entry("t1", "Field One"),
      entry("t2", "Field Two"),
      entry("t3", "Field Three"),
      entry("heirloom", "Sorrow Locket"), // exact single mention, LAST -> pinned
    ]);
    // MUTATION: replace the pin with `.slice(0, maxEntries)` -> heirloom drops, reds.
    const sel = selectGazetteer(wiki, {
      text: "the Sorrow Locket lay among field one, field two, field three",
      maxEntries: 1,
    });
    expect(sel.entries.map((e) => e.id)).toContain("heirloom");
  });
});

describe("selectGazetteer — order + shape", () => {
  it("preserves original wiki order for a stable prompt", () => {
    const wiki = wikiOf([entry("a", "Aaa"), entry("b", "Bbb"), entry("c", "Ccc")]);
    const sel = selectGazetteer(wiki, { text: "Ccc and Aaa appear." });
    expect(sel.entries.map((e) => e.id)).toEqual(["a", "c"]); // original order, b excluded
  });

  it("empty text with no focus selects nothing", () => {
    const wiki = wikiOf([entry("a", "Aaa")]);
    const sel = selectGazetteer(wiki, { text: "" });
    expect(sel.entries).toEqual([]);
  });
});

// keep `ids` referenced for potential future assertions without a lint error
void ids;

describe("findRetrievalMisses — silent-false-negative guard (M5)", () => {
  it("flags an echoed entryId that was NOT sent (retrieval under-selected)", () => {
    // MUTATION: invert the `sent.has(id)` skip -> a sent id wrongly counts as a
    // miss and this expectation (empty for the sent one) reds.
    const misses = findRetrievalMisses(["sent", "unsent"], ["sent"]);
    expect(misses).toEqual(["unsent"]);
  });

  it("returns nothing when every echoed id was sent", () => {
    expect(findRetrievalMisses(["a", "b"], ["a", "b", "c"])).toEqual([]);
  });

  it("ignores blank / undefined echoed ids", () => {
    expect(findRetrievalMisses([undefined, "", "  "], ["a"])).toEqual([]);
  });

  it("de-duplicates repeated misses and preserves first-seen order", () => {
    // MUTATION: drop the `seen` de-dup -> "x" appears twice and this reds.
    const misses = findRetrievalMisses(["x", "y", "x"], ["z"]);
    expect(misses).toEqual(["x", "y"]);
  });

  it("trims whitespace before comparing so a padded sent id is not a miss", () => {
    expect(findRetrievalMisses(["  sent  "], ["sent"])).toEqual([]);
  });
});
