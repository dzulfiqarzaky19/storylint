import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SaveStateFooter from "@/components/write/SaveStateFooter";

// Migrated from e2e `a11yStates.spec.ts` part 1 (TCK-HF5). The load-bearing
// decision is the LIVE-REGION POLITENESS of the manuscript save-state footer: a
// save FAILURE announces assertively (role="alert") so a screen-reader user is
// warned of lost work, while the ordinary saving/saved status stays polite
// (role="status"). The old e2e faulted a real server-action flight round trip to
// reach the error branch; that branch is a pure prop-driven render here.

describe("SaveStateFooter live-region politeness", () => {
  it("announces a save FAILURE assertively via role=alert", () => {
    render(
      <SaveStateFooter error="Save failed" dirty={false} aiChecking={false} />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Save failed");
    // Never the polite role for an error — that could go unannounced.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps the ordinary saved status polite via role=status", () => {
    render(<SaveStateFooter error={null} dirty={false} aiChecking={false} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Saved");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the in-flight and AI-checking states politely", () => {
    const { rerender } = render(
      <SaveStateFooter error={null} dirty={true} aiChecking={false} />,
    );
    // Re-baselined (T-WRITE-JOURNEYS 2.2): the dirty state reads "Unsaved
    // changes" so the chapters journey has a visible dirty indicator to assert
    // against; it replaced the old optimistic "Saving…" copy.
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");

    rerender(
      <SaveStateFooter error={null} dirty={false} aiChecking={true} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Checking with AI");
  });
});
