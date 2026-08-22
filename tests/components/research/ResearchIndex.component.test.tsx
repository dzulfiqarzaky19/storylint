import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ResearchThreadRow } from "@/lib/domain/types";
import ResearchIndex from "@/components/research/ResearchIndex";

// T-RES-E2E-RENAME: locks the optimistic-rename override in ResearchIndex. The
// rendered title comes from the server `threads` PROP, refreshed via
// router.refresh() after the rename persists. That refresh is a lagging
// round-trip (under full-suite load it lagged past the e2e's wait, so the row
// snapped back to the stale "New thread" — the c85bf5c gate FAIL). The override
// shows the new title the instant Enter commits, independent of the refresh.
//
// This proves the override deterministically WITHOUT any timing: the parent's
// onRename here NEVER pushes a new `threads` prop (models the refresh not having
// landed yet). With the override the row still reads the new title; kill the
// override (shownTitle = t.title) and this goes RED — the mutation-proof.

const threads: ResearchThreadRow[] = [
  {
    id: "t1",
    title: "New thread",
    subtitle: "",
    sortOrder: 0,
    scope: "world",
    worldId: "world-vosk",
  } as ResearchThreadRow,
];

describe("ResearchIndex optimistic rename override", () => {
  it("shows the new title on Enter even when the server prop never refreshes", async () => {
    const user = userEvent.setup();
    // onRename is a no-op that does NOT feed a fresh `threads` prop back in —
    // exactly the refresh-lag window that broke c85bf5c. Only the local
    // optimistic map can make the new title appear.
    const onRename = vi.fn();

    render(
      <ResearchIndex
        threads={threads}
        selectedId="t1"
        onSelect={() => {}}
        onRename={onRename}
      />,
    );

    const row = screen.getByRole("button", { name: /new thread/i });
    await user.dblClick(row);
    const input = screen.getByRole("textbox", { name: /thread name/i });
    await user.clear(input);
    await user.type(input, "Water magic notes");
    await user.keyboard("{Enter}");

    // The rename was dispatched to the parent...
    expect(onRename).toHaveBeenCalledWith("t1", "Water magic notes");
    // ...and the row shows the new title immediately, with NO prop refresh.
    expect(
      screen.getByRole("button", { name: /water magic notes/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^new thread$/i }),
    ).not.toBeInTheDocument();
  });
});
