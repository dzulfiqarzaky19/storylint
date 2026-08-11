import { describe, it, expect } from "vitest";
import {
  buildResearchPrompt,
  renderHistory,
  HISTORY_TURN_CAP,
} from "@/lib/research/buildResearchPrompt";
import { CARDS_SENTINEL } from "@/lib/research/streamParse";

describe("buildResearchPrompt (F5 fully-free — no scope directive)", () => {
  // LOCKED LINE 2: the prompt emits NO scope-narrowing directive. POSITIVE +
  // NEGATIVE so a mutant that merely deletes the directive WITHOUT keeping the
  // free-framing can't pass vacuously.
  it("does NOT include a scope-narrowing directive", () => {
    const { system } = buildResearchPrompt("q", "Thread A", "- Alice (character)");
    // NEGATIVE: none of the P2 self-policing language survives.
    expect(system).not.toMatch(/Only answer within/i);
    expect(system).not.toMatch(/scoped to/i);
    expect(system).not.toMatch(/offer to switch/i);
  });

  it("DOES include the all-wiki free-framing string", () => {
    const { system } = buildResearchPrompt("q", "Thread A", "- Alice (character)");
    // POSITIVE: the AI is explicitly told it can draw on the ENTIRE wiki freely.
    expect(system).toMatch(/ENTIRE wiki/);
    expect(system).toMatch(/answer freely/i);
  });

  // LOCKED LINE 3: the prompt STILL emits CARDS_SENTINEL verbatim, else card
  // capture in the route silently breaks.
  it("emits the CARDS_SENTINEL delimiter verbatim", () => {
    const { system } = buildResearchPrompt("q", undefined, "");
    expect(system).toContain(CARDS_SENTINEL);
  });

  it("puts the gazetteer into the user message when non-empty", () => {
    const { user } = buildResearchPrompt("What color is the sky?", "Sky", "- Sun (world)");
    expect(user).toContain("Gazetteer (the writer's wiki):");
    expect(user).toContain("- Sun (world)");
    expect(user).toContain("Writer asks: What color is the sky?");
  });

  it("renders an explicit empty gazetteer line when there are no entries", () => {
    const { user } = buildResearchPrompt("q", undefined, "");
    expect(user).toContain("Gazetteer: (empty)");
  });

  it("includes the thread title line only when a title is given", () => {
    expect(buildResearchPrompt("q", "My Thread", "").user).toContain("Thread: My Thread");
    expect(buildResearchPrompt("q", undefined, "").user).not.toContain("Thread:");
  });
});

// TCK-015 (new-subject vs suggestion classification). The card `kind` enum was
// listed but never taught: the model minted a fake `character` for a mere
// suggestion/connection about EXISTING figures. The system prompt now carries ONE
// directive teaching that character/world/organization/asKind are for a
// GENUINELY NEW subject worth its own entry, while a suggestion/connection about
// subjects that ALREADY exist is lore/beat. Behavior-bearing → mutation-proofed.
describe("buildResearchPrompt (F-015 new-subject vs suggestion classification)", () => {
  // The directive must appear in the system prompt. Mutant: delete the directive
  // line → this goes RED.
  it("teaches character/world/organization only for a genuinely NEW subject", () => {
    const { system } = buildResearchPrompt("q", "Thread A", "- Alice (character)");
    expect(system).toMatch(/genuinely new/i);
  });

  // The directive must teach the reverse: a suggestion/connection about EXISTING
  // subjects is lore/beat, never a new character. Mutant: drop the "already
  // exist"/"never mint" half → this goes RED.
  it("teaches that a suggestion/connection about existing subjects is lore/beat", () => {
    const { system } = buildResearchPrompt("q", "Thread A", "- Alice (character)");
    expect(system).toMatch(/already exist/i);
    expect(system).toMatch(/never mint/i);
    expect(system).toMatch(/lore or beat/i);
  });
});

// F10 GAP1 (web-sources grounding directive). The system prompt's "Ground every
// answer ONLY in the gazetteer" line makes the model REFUSE web context even
// when the route appends it to the user message. So the prompt must — ONLY when
// web context is actually present — tell the model that WEB SOURCES in the user
// message are a legitimate grounding source to cite by URL. When no web context
// is present the prompt stays byte-identical to F5 (the F5 tests above still
// hold), so F5's network-free path is untouched.
describe("buildResearchPrompt (F10 conditional web-sources directive)", () => {
  // The exact conditional line: mutate the `hasWeb ? [...] : []` branch to always
  // include it and the "byte-identical when no web" lock below goes RED; mutate
  // it to never include it and THIS test goes RED.
  it("adds a web-sources grounding directive ONLY when hasWeb is true", () => {
    const withWeb = buildResearchPrompt("q", "T", "- Alice (character)", true).system;
    const withoutWeb = buildResearchPrompt("q", "T", "- Alice (character)", false).system;
    // POSITIVE: with web context, the model is told web sources are citable.
    expect(withWeb).toMatch(/web sources/i);
    expect(withWeb).toMatch(/cite/i);
    // NEGATIVE: without web context, no such directive appears.
    expect(withoutWeb).not.toMatch(/web sources/i);
  });

  // The web branch must NOT drop the gazetteer-first canon rule or the free
  // framing — web is ADDITIVE grounding, the writer's wiki is still preferred for
  // in-world canon and the model still never invents contradicting facts.
  it("keeps the gazetteer/canon framing intact when web sources are present", () => {
    const withWeb = buildResearchPrompt("q", "T", "- Alice (character)", true).system;
    expect(withWeb).toMatch(/never invent contradicting facts/i);
    expect(withWeb).toMatch(/ENTIRE wiki/);
    expect(withWeb).toContain(CARDS_SENTINEL);
  });

  // F5 LOCK: default (no 4th arg) and hasWeb:false BOTH produce the SAME system
  // prompt as before F10 — byte-identical. This is what keeps F5 (and every
  // network-free path) unaffected. A mutant that always injects the web line
  // breaks this equality.
  it("produces a byte-identical system prompt when hasWeb is absent or false (F5 lock)", () => {
    const defaulted = buildResearchPrompt("q", "T", "- Alice (character)").system;
    const explicitFalse = buildResearchPrompt("q", "T", "- Alice (character)", false).system;
    expect(defaulted).toBe(explicitFalse);
    // And it carries none of the web directive.
    expect(defaulted).not.toMatch(/web sources/i);
  });
});

// MEMORY (research-chat statelessness fix). The Collaborator was replying
// "I don't have our earlier conversation" one turn later because the prompt
// carried ONLY the current question. renderHistory feeds prior turns back in as
// a compacted transcript, and buildResearchPrompt inserts them BEFORE the new
// question. Each test below is mutation-sensitive: it fails if the specific
// behavior it locks is removed.
describe("renderHistory (compacted conversation memory)", () => {
  const turn = (side: "you" | "them", text: string) => ({ side, text });

  it("returns empty string for no prior turns (preserves historyless prompt)", () => {
    // Mutant: emit a header even when empty => this goes RED and the F5 lock
    // below (byte-identical) also goes RED.
    expect(renderHistory([])).toBe("");
  });

  it("labels writer vs collaborator and preserves oldest-first order", () => {
    const out = renderHistory([
      turn("you", "Who is Maren?"),
      turn("them", "Maren swore the Oath out of season."),
    ]);
    // POSITIVE: both speakers rendered with the right label.
    expect(out).toBe(
      "Writer: Who is Maren?\nCollaborator: Maren swore the Oath out of season.",
    );
    // NEGATIVE (ordering): the writer's line precedes the collaborator's.
    expect(out.indexOf("Writer:")).toBeLessThan(out.indexOf("Collaborator:"));
  });

  it("keeps only the most recent HISTORY_TURN_CAP turns (drops the oldest)", () => {
    const many = Array.from({ length: HISTORY_TURN_CAP + 3 }, (_, i) =>
      turn(i % 2 === 0 ? "you" : "them", `msg-${i}`),
    );
    const out = renderHistory(many);
    const lines = out.split("\n");
    // Cap honored: exactly HISTORY_TURN_CAP lines survive.
    expect(lines).toHaveLength(HISTORY_TURN_CAP);
    // The 3 oldest are gone; the newest is present.
    expect(out).not.toContain("msg-0");
    expect(out).not.toContain("msg-2");
    expect(out).toContain(`msg-${HISTORY_TURN_CAP + 2}`);
  });

  it("respects an explicit smaller cap", () => {
    const out = renderHistory(
      [turn("you", "a"), turn("them", "b"), turn("you", "c")],
      1,
    );
    expect(out).toBe("Writer: c");
  });

  it("drops blank-text turns (never emits an empty speaker line)", () => {
    const out = renderHistory([turn("you", "   "), turn("them", "real")]);
    expect(out).toBe("Collaborator: real");
  });
});

describe("buildResearchPrompt (memory wiring)", () => {
  it("injects prior turns into the user message before the current question", () => {
    const { user } = buildResearchPrompt("What next?", "Kirn", "- Maren (character)", false, [
      { side: "you", text: "Tell me about the Oath." },
      { side: "them", text: "It is sworn at 21." },
    ]);
    expect(user).toContain("Conversation so far");
    expect(user).toContain("Writer: Tell me about the Oath.");
    expect(user).toContain("Collaborator: It is sworn at 21.");
    // The memory block must come BEFORE the current question.
    expect(user.indexOf("Conversation so far")).toBeLessThan(
      user.indexOf("Writer asks: What next?"),
    );
  });

  it("is byte-identical to the historyless prompt when history is empty (F5/F10 lock)", () => {
    const withEmpty = buildResearchPrompt("q", "T", "- Alice (character)", false, []);
    const historyless = buildResearchPrompt("q", "T", "- Alice (character)", false);
    expect(withEmpty.user).toBe(historyless.user);
    expect(withEmpty.system).toBe(historyless.system);
    expect(withEmpty.user).not.toContain("Conversation so far");
  });

  it("still emits CARDS_SENTINEL with history present", () => {
    const { system } = buildResearchPrompt("q", "T", "", false, [
      { side: "you", text: "hi" },
    ]);
    expect(system).toContain(CARDS_SENTINEL);
  });
});
