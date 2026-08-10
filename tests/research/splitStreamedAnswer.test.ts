import { describe, it, expect } from "vitest";
import { splitStreamedAnswer, CARDS_SENTINEL } from "@/lib/research/streamParse";

// -----------------------------------------------------------------------------
// F2b — hardened parse of the streamed answer buffer (Option C, sentinel format).
// The model streams PROSE, then a sentinel line, then STRICT JSON of the cards.
// The parse runs on the FULL assembled buffer at completion (never mid-stream),
// and must degrade to no-cards-but-keep-the-reply, never crash, mirroring the
// blocking path's try/catch fallback. chick hammers this, so it is locked hard:
//   - split on the LAST sentinel (model may echo the sentinel inside prose)
//   - strict-JSON-or-empty: bad/absent JSON => cards:[] AND reply preserved
//   - the reply the user sees never contains the sentinel or the JSON
// -----------------------------------------------------------------------------

describe("splitStreamedAnswer", () => {
  it("splits prose from cards on the sentinel and parses strict JSON", () => {
    const buf = [
      "Here is a grounded thought about the salt debt.",
      CARDS_SENTINEL,
      JSON.stringify([
        { kind: "world", title: "Salt debt", body: "A name owed.", asKind: "world" },
      ]),
    ].join("\n");

    const { reply, cards } = splitStreamedAnswer(buf);

    expect(reply).toBe("Here is a grounded thought about the salt debt.");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      kind: "world",
      title: "Salt debt",
      body: "A name owed.",
      asKind: "world",
    });
  });

  it("uses the LAST sentinel when the model echoes it inside the prose", () => {
    // The prose itself mentions the sentinel; only the final one is the real split.
    const buf = [
      `The format uses ${CARDS_SENTINEL} as a delimiter, which you should ignore.`,
      CARDS_SENTINEL,
      JSON.stringify([{ kind: "lore", title: "Real card", body: "kept", asKind: "lore" }]),
    ].join("\n");

    const { reply, cards } = splitStreamedAnswer(buf);

    // Reply keeps everything before the LAST sentinel, including the echoed one.
    expect(reply).toBe(`The format uses ${CARDS_SENTINEL} as a delimiter, which you should ignore.`);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.title).toBe("Real card");
  });

  it("falls back to cards:[] and keeps the full reply when there is no sentinel", () => {
    const buf = "Just prose, the model never emitted a sentinel or any cards.";

    const { reply, cards } = splitStreamedAnswer(buf);

    expect(reply).toBe("Just prose, the model never emitted a sentinel or any cards.");
    expect(cards).toEqual([]);
  });

  it("falls back to cards:[] but KEEPS the prose when post-sentinel JSON is malformed", () => {
    const buf = ["Solid reasoning here.", CARDS_SENTINEL, "{ this is not valid json ]"].join("\n");

    const { reply, cards } = splitStreamedAnswer(buf);

    expect(reply).toBe("Solid reasoning here.");
    expect(cards).toEqual([]);
  });

  it("falls back to cards:[] when the post-sentinel JSON is valid but not an array", () => {
    const buf = ["Prose.", CARDS_SENTINEL, JSON.stringify({ reply: "oops", cards: [] })].join("\n");

    const { reply, cards } = splitStreamedAnswer(buf);

    expect(reply).toBe("Prose.");
    expect(cards).toEqual([]);
  });

  it("trims a trailing partial sentinel from the reply (stream cut mid-sentinel)", () => {
    // If the stream ends after emitting only a prefix of the sentinel, that prefix
    // must not leak into the user-visible reply.
    const partial = CARDS_SENTINEL.slice(0, 4);
    const buf = `A complete thought.\n${partial}`;

    const { reply, cards } = splitStreamedAnswer(buf);

    expect(reply).toBe("A complete thought.");
    expect(cards).toEqual([]);
  });

  it("keeps a card with only a title OR only a body, drops one with neither", () => {
    // Locks the OR semantics: a card needs a title OR a body (not both). An
    // entry with neither is the only one dropped.
    const buf = [
      "Prose.",
      CARDS_SENTINEL,
      JSON.stringify([
        { kind: "world", title: "", body: "", asKind: "world" },
        { kind: "lore", title: "Title only", body: "", asKind: "lore" },
        { kind: "world", title: "", body: "Body only", asKind: "world" },
        { kind: "lore", title: "Both", body: "has content", asKind: "lore" },
      ]),
    ].join("\n");

    const { cards } = splitStreamedAnswer(buf);

    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.title)).toEqual(["Title only", "", "Both"]);
    expect(cards.map((c) => c.body)).toEqual(["", "Body only", "has content"]);
  });

  it("caps cards at 3 (mirrors the blocking path)", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      kind: "lore",
      title: `Card ${i}`,
      body: "body",
      asKind: "lore",
    }));
    const buf = ["Prose.", CARDS_SENTINEL, JSON.stringify(many)].join("\n");

    const { cards } = splitStreamedAnswer(buf);

    expect(cards).toHaveLength(3);
  });
});
