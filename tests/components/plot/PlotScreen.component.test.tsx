import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlotProgression } from "@/lib/db/plot";
import PlotScreen from "@/components/plot/PlotScreen";

// T-ARCH-7: PlotScreen.tsx's StoryDrawer rename now dispatches through the
// shared useInlineRename hook (dedup, not unification). This locks
// PlotScreen's OWN quirk unchanged by the dedup: it has NO reset branch at
// all (no onReset passed to the hook) — a blank or unchanged trimmed draft is
// simply not committed (no rename action fires), unlike Shelf/WikiIndex which
// both have a reset-to-default path for a blank draft.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const rename = vi.fn(
  async (_arg: { plotlineId: string; name: string }) => ({
    ok: true,
    value: undefined,
  }),
);
vi.mock("@/lib/actions/plot", () => ({
  renamePlotlineAction: (arg: { plotlineId: string; name: string }) =>
    rename(arg),
  setPlotlineStateAction: vi.fn(async () => ({ ok: true, value: undefined })),
  upsertBeatAction: vi.fn(async () => ({ ok: true, value: undefined })),
  deleteBeatAction: vi.fn(async () => ({ ok: true, value: undefined })),
  moveBeatAction: vi.fn(async () => ({ ok: true, value: undefined })),
  createPlotlineAction: vi.fn(async () => ({ ok: true, value: undefined })),
  deletePlotlineAction: vi.fn(async () => ({ ok: true, value: undefined })),
}));

const progression: PlotProgression = {
  chapters: [{ id: "c1", number: 1, title: "Chapter 1" }],
  lanes: [
    {
      id: "lane-1",
      name: "Main story",
      label: "main story",
      ownerName: null,
      beats: [],
      lastAdvanced: null,
      neglect: 0,
      state: "open",
      resolvedAt: null,
      colorIndex: 0,
    },
  ],
  latestChapter: 1,
  completion: { resolved: 0, owed: 1, percent: 0 },
};

async function openDrawer(user: ReturnType<typeof userEvent.setup>) {
  render(
    <PlotScreen progression={progression} worldId="world-1" bookId="book-1" />,
  );
  await user.click(
    screen.getByRole("rowheader", { name: "Open Main story story so far" }),
  );
}

describe("PlotScreen StoryDrawer inline rename (useInlineRename dedup)", () => {
  it("a blank committed draft does NOT rename (no reset branch here)", async () => {
    const user = userEvent.setup();
    rename.mockClear();
    await openDrawer(user);

    await user.click(screen.getByRole("button", { name: "Rename plotline" }));
    const input = screen.getByRole("textbox", { name: "Plotline name" });
    await user.clear(input);
    await user.keyboard("{Enter}");

    expect(rename).not.toHaveBeenCalled();
  });

  it("an unchanged (trimmed-equal) draft does NOT rename", async () => {
    const user = userEvent.setup();
    rename.mockClear();
    await openDrawer(user);

    await user.click(screen.getByRole("button", { name: "Rename plotline" }));
    const input = screen.getByRole("textbox", { name: "Plotline name" });
    await user.type(input, "  ");
    await user.keyboard("{Enter}");

    expect(rename).not.toHaveBeenCalled();
  });

  it("a changed draft commits the rename", async () => {
    const user = userEvent.setup();
    rename.mockClear();
    await openDrawer(user);

    await user.click(screen.getByRole("button", { name: "Rename plotline" }));
    const input = screen.getByRole("textbox", { name: "Plotline name" });
    await user.clear(input);
    await user.type(input, "The real story");
    await user.keyboard("{Enter}");

    expect(rename).toHaveBeenCalledWith({
      plotlineId: "lane-1",
      name: "The real story",
    });
  });
});
