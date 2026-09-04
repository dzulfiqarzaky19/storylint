import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EntryBand from "@/components/wiki/entry/EntryBand";
import { DragProvider } from "@/components/dnd/DragContext";
import type { EntryWithDetails } from "@/lib/domain/types";

// EntryBand's head renders ShareControls, which calls useRouter — mock it the
// same way PlotScreen's test does (App Router context isn't mounted in RTL).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// T-WIKI-COCKPIT-1: EntryBand is a fixed head over a 4-tab body. These lock the
// tab SHELL's contract — exactly one panel is mounted at a time, and switching
// swaps which one. The panels' own behavior is unchanged and tested elsewhere;
// what is new here is the show/hide, so that is what is proven.

const entry: EntryWithDetails = {
  id: "e1",
  kind: "character",
  name: "Corin Sarn",
  catalogueNo: "001",
  note: "",
  summary: "Halvard's elder brother, long counted among the drowned.",
  shelf: "people",
  sortOrder: 0,
  deletedAt: null,
  facts: [
    { id: "f1", entryId: "e1", key: "Age", value: "41", fresh: false, sortOrder: 0 },
    { id: "f2", entryId: "e1", key: "Trade", value: "Ferryman", fresh: false, sortOrder: 1 },
  ],
  ties: [
    {
      id: "t1",
      fromEntryId: "e1",
      toEntryId: "e2",
      rel: "brother",
      toName: "Halvard Sarn",
      toKind: "character",
      toCatalogueNo: "002",
    },
    // Points at an entry absent from liveEntryIds -> tombstoned, so it must NOT
    // be counted by the Ties tab pill (which counts standing relationships).
    {
      id: "t2",
      fromEntryId: "e1",
      toEntryId: "gone",
      rel: "rival",
      toName: "The Ninth Bell",
      toKind: "character",
      toCatalogueNo: "003",
    },
  ],
  appearances: [
    {
      id: "a1",
      entryId: "e1",
      chapter: 3,
      text: "First sighting at the harbour.",
      flag: null,
      flagText: null,
      sortOrder: 0,
      bookId: "book-1",
    },
    {
      id: "a2",
      entryId: "e1",
      chapter: 7,
      text: "Pays the ninth toll under a salt-name.",
      flag: null,
      flagText: null,
      sortOrder: 1,
      bookId: "book-1",
    },
  ],
  openQuestions: [
    { id: "q1", entryId: "e1", text: "Is it truly Corin?", sortOrder: 0 },
  ],
};

function renderBand() {
  render(
    <DragProvider>
      <EntryBand
        entry={entry}
        liveEntryIds={new Set(["e1", "e2"])}
        onSelect={() => {}}
        onDelete={() => {}}
        sharing={{ worlds: [], activeWorldId: "w1", onError: () => {} }}
        onDropOnTies={() => {}}
        tieCandidates={[]}
        onUntie={() => {}}
        onTieExisting={() => {}}
        onCreateTied={() => {}}
        onDropSuggestion={() => {}}
        onEditEntryField={() => {}}
        onEditFactField={() => {}}
        onAddFact={() => {}}
        onDeleteFact={() => {}}
      />
    </DragProvider>,
  );
}

describe("EntryBand tab shell", () => {
  it("renders all four tabs with Overview active by default", () => {
    renderBand();

    for (const label of ["Overview", "Timeline", "Details", "Ties"]) {
      expect(screen.getByRole("tab", { name: new RegExp(label) })).toBeTruthy();
    }
    expect(
      screen.getByRole("tab", { name: /Overview/ }).getAttribute("aria-selected"),
    ).toBe("true");
    // Overview's own content is on screen; the other panels are not mounted.
    // "Summary" is NOT a heading here: the writer's summary is the head blurb
    // under the entry name, not an Overview section (one edit surface per value).
    expect(screen.getByRole("heading", { name: /^Latest/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Summary" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "The story so far" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Still open" })).toBeNull();
  });

  it("switching to a tab shows that panel and unmounts the previous one", async () => {
    const user = userEvent.setup();
    renderBand();

    await user.click(screen.getByRole("tab", { name: /Timeline/ }));
    expect(screen.getByRole("heading", { name: "The story so far" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /^Latest/ })).toBeNull();

    await user.click(screen.getByRole("tab", { name: /Details/ }));
    expect(screen.getByRole("heading", { name: "Details" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Still open" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "The story so far" })).toBeNull();

    await user.click(screen.getByRole("tab", { name: /Ties/ }));
    expect(screen.getByRole("heading", { name: "Ties" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Still open" })).toBeNull();
  });

  it("marks only the clicked tab as selected", async () => {
    const user = userEvent.setup();
    renderBand();

    await user.click(screen.getByRole("tab", { name: /Details/ }));

    const selected = screen
      .getAllByRole("tab")
      .filter((t) => t.getAttribute("aria-selected") === "true")
      .map((t) => t.textContent);
    expect(selected).toHaveLength(1);
    expect(selected[0]).toContain("Details");
  });

  it("counts facts on the Details pill and only LIVE ties on the Ties pill", () => {
    renderBand();

    // 2 facts; 2 ties but one is tombstoned, so the Ties pill reads 1.
    expect(screen.getByRole("tab", { name: /Details/ }).textContent).toContain("2");
    expect(screen.getByRole("tab", { name: /Ties/ }).textContent).toContain("1");
  });

  it("keeps the entry identity in the head, outside the tabs", async () => {
    const user = userEvent.setup();
    renderBand();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Corin Sarn",
    );
    // Still there after switching away from the default tab.
    await user.click(screen.getByRole("tab", { name: /Ties/ }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Corin Sarn",
    );
  });

  it("Overview's Latest block shows the tail appearance with its chapter cite", () => {
    renderBand();

    expect(screen.getByText("Pays the ninth toll under a salt-name.")).toBeTruthy();
    expect(screen.getByText("Ch. 7")).toBeTruthy();
    // The earlier beat belongs to the Timeline tab, not Overview's Latest.
    expect(screen.queryByText("First sighting at the harbour.")).toBeNull();
  });
});
