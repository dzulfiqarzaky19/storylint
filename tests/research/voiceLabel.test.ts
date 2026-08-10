import { describe, it, expect } from "vitest";
import { voiceLabel, COLLABORATOR_LABEL } from "@/lib/research/voice";

// -----------------------------------------------------------------------------
// F2a (e) — voice relabel (pure). Legacy turns stored with the old "Research"
// speaker label must RENDER as "Collaborator" without a data migration; every
// other label passes through unchanged. This is the pure core Turn.tsx consumes
// for display. The seed now stores "Collaborator" directly, so this legacy
// branch is otherwise unexercised end-to-end — hence it is locked here.
// -----------------------------------------------------------------------------

describe("voiceLabel", () => {
  it("maps the legacy 'Research' label to 'Collaborator'", () => {
    expect(voiceLabel("Research")).toBe(COLLABORATOR_LABEL);
    expect(voiceLabel("Research")).toBe("Collaborator");
  });

  it("passes the current 'Collaborator' label through unchanged", () => {
    expect(voiceLabel("Collaborator")).toBe("Collaborator");
  });

  it("passes the writer's 'You' label through unchanged", () => {
    expect(voiceLabel("You")).toBe("You");
  });

  it("passes any other free-text label through unchanged", () => {
    expect(voiceLabel("Editor")).toBe("Editor");
    expect(voiceLabel("")).toBe("");
  });
});
