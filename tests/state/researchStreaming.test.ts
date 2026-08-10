import { describe, it, expect } from "vitest";
import {
  researchReducer,
  initResearchState,
  type ResearchState,
} from "@/lib/state/researchStore";
import type { ResearchTurnWithCards, ResearchProposition } from "@/lib/domain/types";

// -----------------------------------------------------------------------------
// F2b — reducer streaming actions. The reducer is the SOLE owner of `turns`. A
// streamed answer arrives as: APPEND_STREAMING_TURN (question + empty answer
// placeholder), one or more STREAM_DELTA (grow the placeholder text), then
// RECONCILE_TURN (swap the placeholder for the server-persisted turn with real
// id/ordinal/cards). Persistence is server-side; these actions only reflect it.
// -----------------------------------------------------------------------------

function baseState(): ResearchState {
  return initResearchState({ question: "", turns: [], initialVisibleTurnIds: [] });
}

function turn(over: Partial<ResearchTurnWithCards>): ResearchTurnWithCards {
  return {
    id: "t",
    threadId: "th1",
    ordinal: 0,
    side: "them",
    who: "Collaborator",
    text: "",
    cards: [],
    ...over,
  };
}

function card(over: Partial<ResearchProposition>): ResearchProposition {
  return {
    id: "c",
    turnId: "t",
    kind: "lore",
    title: "T",
    body: "B",
    asKind: "lore",
    sortOrder: 0,
    kept: false,
    inWiki: false,
    ...over,
  } as ResearchProposition;
}

describe("researchReducer — APPEND_STREAMING_TURN", () => {
  it("appends the question + placeholder turns and reveals both, clearing error", () => {
    const start = { ...baseState(), error: "old error" };
    const you = turn({ id: "you1", side: "you", who: "You", text: "Q?" });
    const them = turn({ id: "them1", text: "" });

    const next = researchReducer(start, { type: "APPEND_STREAMING_TURN", turns: [you, them] });

    expect(next.turns.map((t) => t.id)).toEqual(["you1", "them1"]);
    expect(next.visibleTurnIds).toEqual(["you1", "them1"]);
    expect(next.error).toBeNull();
  });
});

describe("researchReducer — STREAM_DELTA", () => {
  it("appends text ONLY to the matching turn, leaving others untouched", () => {
    const you = turn({ id: "you1", side: "you", who: "You", text: "Q?" });
    const them = turn({ id: "them1", text: "Hel" });
    const start = researchReducer(baseState(), {
      type: "APPEND_STREAMING_TURN",
      turns: [you, them],
    });

    const next = researchReducer(start, { type: "STREAM_DELTA", turnId: "them1", text: "lo" });

    expect(next.turns.find((t) => t.id === "them1")?.text).toBe("Hello");
    expect(next.turns.find((t) => t.id === "you1")?.text).toBe("Q?");
  });

  it("accumulates across multiple deltas", () => {
    const them = turn({ id: "them1", text: "" });
    let s = researchReducer(baseState(), { type: "APPEND_STREAMING_TURN", turns: [them] });
    s = researchReducer(s, { type: "STREAM_DELTA", turnId: "them1", text: "a" });
    s = researchReducer(s, { type: "STREAM_DELTA", turnId: "them1", text: "b" });
    s = researchReducer(s, { type: "STREAM_DELTA", turnId: "them1", text: "c" });

    expect(s.turns.find((t) => t.id === "them1")?.text).toBe("abc");
  });

  it("is a no-op when no turn id matches", () => {
    const them = turn({ id: "them1", text: "keep" });
    const start = researchReducer(baseState(), { type: "APPEND_STREAMING_TURN", turns: [them] });

    const next = researchReducer(start, { type: "STREAM_DELTA", turnId: "nope", text: "X" });

    expect(next.turns.find((t) => t.id === "them1")?.text).toBe("keep");
  });
});

describe("researchReducer — RECONCILE_TURN", () => {
  it("replaces the placeholder with the persisted turn and remaps its visible id", () => {
    const them = turn({ id: "temp-them", text: "streamed prose" });
    const start = researchReducer(baseState(), { type: "APPEND_STREAMING_TURN", turns: [them] });

    const persisted = turn({
      id: "real-them",
      ordinal: 5,
      text: "streamed prose",
      cards: [card({ id: "card1", turnId: "real-them" })],
    });
    const next = researchReducer(start, {
      type: "RECONCILE_TURN",
      tempTurnId: "temp-them",
      turn: persisted,
    });

    expect(next.turns.map((t) => t.id)).toEqual(["real-them"]);
    expect(next.turns[0]?.ordinal).toBe(5);
    expect(next.turns[0]?.cards[0]?.id).toBe("card1");
    // The placeholder id must no longer linger in visibleTurnIds.
    expect(next.visibleTurnIds).toEqual(["real-them"]);
  });

  it("folds the persisted cards' kept / inWiki flags into the boards", () => {
    const them = turn({ id: "temp-them" });
    const start = researchReducer(baseState(), { type: "APPEND_STREAMING_TURN", turns: [them] });

    const persisted = turn({
      id: "real-them",
      cards: [
        card({ id: "keptCard", kept: true }),
        card({ id: "wikiCard", inWiki: true }),
        card({ id: "plainCard" }),
      ],
    });
    const next = researchReducer(start, {
      type: "RECONCILE_TURN",
      tempTurnId: "temp-them",
      turn: persisted,
    });

    expect(next.keptIds).toContain("keptCard");
    expect(next.inWikiIds).toContain("wikiCard");
    expect(next.keptIds).not.toContain("plainCard");
  });
});

describe("researchReducer — ROLLBACK_STREAMING_TURN", () => {
  it("removes the named placeholder turns from turns and visibleTurnIds", () => {
    const you = turn({ id: "you1", side: "you", who: "You", text: "Q?" });
    const them = turn({ id: "them1", text: "half-streamed" });
    const start = researchReducer(baseState(), {
      type: "APPEND_STREAMING_TURN",
      turns: [you, them],
    });

    const next = researchReducer(start, {
      type: "ROLLBACK_STREAMING_TURN",
      turnIds: ["you1", "them1"],
    });

    expect(next.turns).toHaveLength(0);
    expect(next.visibleTurnIds).toHaveLength(0);
  });

  it("leaves turns NOT named in turnIds untouched", () => {
    const keep = turn({ id: "keep1", text: "persisted earlier" });
    const you = turn({ id: "you1", side: "you", who: "You", text: "Q?" });
    const them = turn({ id: "them1", text: "half" });
    let s = researchReducer(baseState(), { type: "APPEND_STREAMING_TURN", turns: [keep] });
    s = researchReducer(s, { type: "APPEND_STREAMING_TURN", turns: [you, them] });

    const next = researchReducer(s, {
      type: "ROLLBACK_STREAMING_TURN",
      turnIds: ["you1", "them1"],
    });

    expect(next.turns.map((t) => t.id)).toEqual(["keep1"]);
    expect(next.visibleTurnIds).toEqual(["keep1"]);
  });
});

// -----------------------------------------------------------------------------
// Bugfix — silent vanish. On a stream that ends with NO terminal frame the
// handler dispatches ROLLBACK_STREAMING_TURN followed by SET_ERROR (the retry
// message from `decideStreamEnd`). This locks the reducer invariant that makes
// that pair correct: ROLLBACK does NOT clear `error`, and SET_ERROR does NOT
// resurrect turns — so the two dispatches co-exist as "no orphan placeholder
// AND a visible error", and a retry's APPEND_STREAMING_TURN clears the error.
// -----------------------------------------------------------------------------
describe("researchReducer — silent-vanish recovery (rollback + error co-occur)", () => {
  it("ROLLBACK then SET_ERROR leaves no orphan placeholder AND a visible error", () => {
    const you = turn({ id: "you1", side: "you", who: "You", text: "Q?" });
    const them = turn({ id: "them1", text: "" });
    let s = researchReducer(baseState(), {
      type: "APPEND_STREAMING_TURN",
      turns: [you, them],
    });

    s = researchReducer(s, { type: "ROLLBACK_STREAMING_TURN", turnIds: ["you1", "them1"] });
    // ROLLBACK must not touch error (still none yet)...
    expect(s.error).toBeNull();

    s = researchReducer(s, {
      type: "SET_ERROR",
      error: "The answer didn't finish streaming. Please try again.",
    });

    // ...and after SET_ERROR: the placeholders are gone AND the error is shown.
    expect(s.turns).toHaveLength(0);
    expect(s.visibleTurnIds).toHaveLength(0);
    expect(s.error).toBe("The answer didn't finish streaming. Please try again.");
  });

  it("a retry's APPEND_STREAMING_TURN clears the stale error", () => {
    let s = researchReducer(baseState(), {
      type: "SET_ERROR",
      error: "The answer didn't finish streaming. Please try again.",
    });
    expect(s.error).toBe("The answer didn't finish streaming. Please try again.");

    const you = turn({ id: "you2", side: "you", who: "You", text: "Q again?" });
    const them = turn({ id: "them2", text: "" });
    s = researchReducer(s, { type: "APPEND_STREAMING_TURN", turns: [you, them] });

    expect(s.error).toBeNull();
    expect(s.turns.map((t) => t.id)).toEqual(["you2", "them2"]);
  });
});
