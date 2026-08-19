import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OutstandingRail } from "@/components/write/OutstandingRail";

// Migrated from the e2e spec `b2PromiseHeading.spec.ts` (TCK-HF2W-B2). This is a
// pure render/a11y-semantics check — no app, no server, no DB — so it belongs in
// the component tier, NOT e2e. It proves the rail's closing promise copy exposes
// a real heading (role=heading, level 2) inside the labelled complementary
// landmark, without booting the whole /write page.

describe("OutstandingRail promise copy (a11y semantics)", () => {
  const noMarks = { marks: [], openMarkKey: null, onSelect: () => {} };

  it("renders the closing promise as a level-2 heading", () => {
    render(<OutstandingRail {...noMarks} />);
    const heading = screen.getByRole("heading", {
      level: 2,
      name: /nothing enters the gazetteer until you write it in\./i,
    });
    expect(heading).toBeInTheDocument();
  });

  it("keeps the complementary landmark labelled 'Outstanding marks'", () => {
    render(<OutstandingRail {...noMarks} />);
    expect(
      screen.getByRole("complementary", { name: "Outstanding marks" }),
    ).toBeInTheDocument();
  });
});
