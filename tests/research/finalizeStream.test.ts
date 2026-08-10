import { describe, it, expect, vi } from "vitest";
import {
  finalizeStreamedAnswer,
  normalizeStreamedCards,
  type PersistArgs,
} from "@/lib/research/finalizeStream";
import { CARDS_SENTINEL } from "@/lib/research/streamParse";

// -----------------------------------------------------------------------------
// F2b HARD GATE — the persist decision for a streamed answer. Proven with a
// FAKE persist (no live gateway, no DB): the property under test is *whether*
// and *with what* persist is called, which is exactly the half-pair invariant
// chick gates. Cards are parsed from the FULL buffer only, at completion.
// -----------------------------------------------------------------------------

function fakePersist() {
  return vi.fn(async (_args: PersistArgs) => ({
    you: { ordinal: 4 },
    them: { ordinal: 5 },
  }));
}

const base = {
  threadId: "th1",
  question: "What color is the sky?",
  youId: "you1",
  themId: "them1",
};

describe("finalizeStreamedAnswer — persist gate", () => {
  it("persists the pair ONCE when the stream completed with a non-empty reply", async () => {
    const persist = fakePersist();
    const out = await finalizeStreamedAnswer({
      ...base,
      completed: true,
      buffer: "The sky is blue.",
      persist,
    });

    expect(persist).toHaveBeenCalledTimes(1);
    expect(out).not.toBeNull();
    expect(out?.youTurn.text).toBe("What color is the sky?");
    expect(out?.themTurn.text).toBe("The sky is blue.");
    // Ordinals come from the persist result, not invented client-side.
    expect(out?.youTurn.ordinal).toBe(4);
    expect(out?.themTurn.ordinal).toBe(5);
  });

  it("persists NOTHING and returns null when the stream did NOT complete (abort)", async () => {
    const persist = fakePersist();
    const out = await finalizeStreamedAnswer({
      ...base,
      completed: false,
      buffer: "The sky is bl", // partial answer that never reached message_stop
      persist,
    });

    expect(persist).not.toHaveBeenCalled();
    expect(out).toBeNull();
  });

  it("persists NOTHING when the completed reply is empty (whitespace only)", async () => {
    const persist = fakePersist();
    const out = await finalizeStreamedAnswer({
      ...base,
      completed: true,
      buffer: "   \n  ",
      persist,
    });

    expect(persist).not.toHaveBeenCalled();
    expect(out).toBeNull();
  });

  it("parses cards from the FULL buffer (prose + sentinel + JSON) at completion", async () => {
    const persist = fakePersist();
    const buffer =
      "The sky is blue." +
      CARDS_SENTINEL +
      JSON.stringify([{ kind: "lore", title: "Sky", body: "It is blue.", asKind: "lore" }]);

    const out = await finalizeStreamedAnswer({ ...base, completed: true, buffer, persist });

    // The reply the writer sees excludes the sentinel + JSON.
    expect(out?.themTurn.text).toBe("The sky is blue.");
    expect(out?.themTurn.cards).toHaveLength(1);
    expect(out?.themTurn.cards[0]?.title).toBe("Sky");
    // The SAME cards were handed to persist (streamed == blocking shape).
    expect(persist.mock.calls[0]?.[0].cards).toHaveLength(1);
    expect(persist.mock.calls[0]?.[0].cards[0]?.title).toBe("Sky");
  });
});

describe("normalizeStreamedCards — clamp to persisted shape", () => {
  it("clamps an unknown kind / asKind to 'lore'", () => {
    const out = normalizeStreamedCards([{ kind: "wizardry", title: "T", body: "B", asKind: "hex" }], "p");
    expect(out[0]?.kind).toBe("lore");
    expect(out[0]?.asKind).toBe("lore");
  });

  it("keeps an allow-listed kind and asKind unchanged", () => {
    const out = normalizeStreamedCards(
      [{ kind: "character", title: "T", body: "B", asKind: "world" }],
      "p",
    );
    expect(out[0]?.kind).toBe("character");
    expect(out[0]?.asKind).toBe("world");
  });

  it("defaults a missing title to 'Untitled' and trims", () => {
    const out = normalizeStreamedCards([{ body: "B" }, { title: "  spaced  ", body: "B" }], "p");
    expect(out[0]?.title).toBe("Untitled");
    expect(out[1]?.title).toBe("spaced");
  });
});
