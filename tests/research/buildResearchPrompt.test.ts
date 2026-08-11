import { describe, it, expect } from "vitest";
import { buildResearchPrompt } from "@/lib/research/buildResearchPrompt";
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
