import { describe, it, expect } from "vitest";
import { buildCheckInput, toCheckWiki } from "@/lib/write/adapters";
import { checkManuscript } from "@/lib/check";
import type { WikiSnapshot as DbWiki, EntryWithDetails } from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// toCheckWiki projection contract (M4 regression guard).
//
// The client `wiki` prop is the SOLE, load-time source for the live deterministic
// engine (Manuscript pushDeterministicMarks re-runs checkManuscript over this
// exact projection). toCheckWiki (adapters.ts) shrinks the rich DB snapshot down
// to what the engine reads — dropping ties/appearances/openQuestions/byId. That
// shrink is M4's real payload win, and it is SAFE only as long as it keeps every
// field the unrecorded/contradiction engine actually consumes.
//
// The engine's unrecorded pass (unrecorded.ts) flags entity-anchored phrases:
//   U2  "the <T> <designator>"  where T is a token recorded on SOME entry and
//       <designator> ∈ {rule, oath, law, …}. buildTokenOwners indexes a token as
//       recorded from entry.name, entry.NOTE, and every fact.value. So a token
//       living ONLY in the note (e.g. "tallow") still anchors the mark.
//   U1  "<poss-pron> <noun>'s <qualified object>" → anchors to a character whose
//       first name appeared earlier; suppressed if the phrase is in the lexicon.
//
// This test locks that contract with the engine's own seed examples:
//   - Drop entry.note  -> "the tallow rule" loses its token owner -> NO mark.
//   - Drop fact.value  -> a recorded heirloom stops being suppressed -> new mark.
// If anyone prunes a load-bearing field from toCheckWiki, one of these flips.
//
// It also documents what IS safe to drop: fact.id / fact.entryId are never read
// off the wiki payload (markKeys use result/candidate entryIds), so removing them
// leaves every mark byte-identical — asserted at the bottom (this is why the M4
// "2-field trim" would be behavior-safe, though we skipped it as not worth the
// shared-type change).
//
// Pure in-memory unit test: real engine, no DB, no browser, no reseed.
// ---------------------------------------------------------------------------

function dbEntry(
  over: Partial<EntryWithDetails> & Pick<EntryWithDetails, "id" | "name" | "note">,
): EntryWithDetails {
  return {
    id: over.id,
    kind: over.kind ?? "character",
    name: over.name,
    catalogueNo: over.catalogueNo ?? "00",
    note: over.note,
    summary: over.summary ?? "",
    shelf: over.shelf ?? "people",
    sortOrder: over.sortOrder ?? 0,
    deletedAt: over.deletedAt ?? null,
    facts: over.facts ?? [],
    ties: over.ties ?? [],
    appearances: over.appearances ?? [],
    openQuestions: over.openQuestions ?? [],
  };
}

// A character (Maren) so U1 possessive-anchoring has a target, and a lore entry
// (Verge Light) whose NOTE carries the lone token "tallow" that U2 needs.
const MAREN = dbEntry({
  id: "maren",
  kind: "character",
  name: "Maren Vell",
  note: "lamp-keeper",
  facts: [
    { id: "f1", entryId: "maren", key: "heirloom", value: "brass ring", fresh: false, sortOrder: 0 },
  ],
});
const VERGE = dbEntry({
  id: "vergelight",
  kind: "lore",
  name: "Verge Light",
  note: "a beacon fed on tallow through the long dark",
  shelf: "lore",
  facts: [],
});

const DB_WIKI: DbWiki = {
  entries: [MAREN, VERGE],
  byId: { maren: MAREN, vergelight: VERGE },
  overrides: {},
};

function doc(paragraphs: string[]): unknown {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    })),
  };
}

/** Missing-mark quotes the real engine flags for a body against a given DbWiki. */
function missingQuotes(paragraphs: string[], db: DbWiki = DB_WIKI): string[] {
  const { marks } = checkManuscript(buildCheckInput({ body: doc(paragraphs), db }));
  return marks.filter((m) => m.kind === "missing").map((m) => m.quote.toLowerCase());
}

describe("toCheckWiki projection keeps every load-bearing lexicon field", () => {
  it("U2 baseline: 'the tallow rule' flags when the token 'tallow' is recorded (in a note)", () => {
    // "tallow" is recorded only via Verge Light's note; "tallow rule" itself is
    // not in the lexicon, so the engine flags it as unrecorded detail.
    expect(missingQuotes(["He would not break the tallow rule."])).toContain("the tallow rule");
  });

  it("preserves entry.note: dropping the note removes the token owner and the mark vanishes", () => {
    // Same body, but the projection's note is emptied. Now "tallow" is owned by
    // no entry -> U2 finds no anchor -> the mark disappears. This is the exact
    // false-NEGATIVE regression that dropping note from toCheckWiki would cause.
    const noNoteDb: DbWiki = {
      entries: [MAREN, { ...VERGE, note: "" }],
      byId: { maren: MAREN, vergelight: { ...VERGE, note: "" } },
      overrides: {},
    };
    expect(missingQuotes(["He would not break the tallow rule."], noNoteDb)).not.toContain(
      "the tallow rule",
    );
  });

  it("preserves entry.name: the engine reads names into the projection (Maren anchors U1)", () => {
    // With Maren present and named earlier, a possessed heirloom anchors to her.
    // "her father's silver knife" is not recorded, so it surfaces as missing —
    // proving the character name survived the projection into the engine.
    const quotes = missingQuotes([
      "Maren stood at the rail. She turned her father's silver knife in the light.",
    ]);
    expect(quotes).toContain("her father's silver knife");
  });

  it("preserves fact.value: a token recorded ONLY via a fact value still anchors a U2 mark", () => {
    // buildTokenOwners indexes tokens from fact.value too. Maren records the fact
    // value "brass ring"; the token "brass" is therefore recorded. "the brass
    // ledger" is a U2 designator phrase whose token "brass" is owned only through
    // that fact value, so it surfaces as unrecorded detail about Maren.
    expect(missingQuotes(["She checked the brass ledger at dawn."])).toContain(
      "the brass ledger",
    );

    // Control: strip the fact value and "brass" loses its only owner, so U2 finds
    // no anchor and the mark vanishes — proving the mark above is load-bearing on
    // fact.value, not vacuous.
    const noFactDb: DbWiki = {
      entries: [{ ...MAREN, facts: [] }, VERGE],
      byId: { maren: { ...MAREN, facts: [] }, vergelight: VERGE },
      overrides: {},
    };
    expect(
      missingQuotes(["She checked the brass ledger at dawn."], noFactDb),
    ).not.toContain("the brass ledger");
  });
});

describe("fact.id / fact.entryId are NOT load-bearing on the wiki payload", () => {
  it("dropping fact.id and fact.entryId leaves every mark identical", () => {
    const paragraphs = [
      "Maren stood at the rail. She turned her father's silver knife.",
      "He would not break the tallow rule.",
    ];

    // Full projection (fact.id + fact.entryId present).
    const full = checkManuscript({ paragraphs, wiki: toCheckWiki(DB_WIKI) });

    // Same projection, fact.id/entryId stripped. The engine builds markKeys from
    // result/candidate entryIds, never from these payload fact ids, so the mark
    // set must be byte-identical.
    const lean = checkManuscript({
      paragraphs,
      wiki: {
        entries: DB_WIKI.entries.map((e) => ({
          id: e.id,
          kind: e.kind,
          name: e.name,
          note: e.note,
          facts: e.facts.map((f) => ({ key: f.key, value: f.value })),
        })),
      } as Parameters<typeof checkManuscript>[0]["wiki"],
    });

    const keys = (r: { marks: { markKey: string }[] }) =>
      r.marks.map((m) => m.markKey).sort();
    expect(keys(lean)).toEqual(keys(full));
  });
});
