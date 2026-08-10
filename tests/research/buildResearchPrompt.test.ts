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
