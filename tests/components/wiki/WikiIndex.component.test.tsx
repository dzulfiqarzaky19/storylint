import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CategoryRow, EntryWithDetails } from "@/lib/domain/types";
import WikiIndex from "@/components/wiki/shelf/WikiIndex";

// T-ARCH-7: WikiIndex.tsx's per-category rename now dispatches through the
// shared useInlineRename hook (via the local CategoryTitle subcomponent —
// dedup, not unification). This locks WikiIndex's OWN quirk unchanged: the
// commit decision routes through resolveRename (shelfState.ts), so an
// UNCHANGED draft is a true no-op — neither callback fires — unlike Shelf's
// (which has no separate no-op branch) or PlotScreen's (no reset at all).

const categories: CategoryRow[] = [
  {
    id: "people",
    label: "People",
    shelf: "people",
    sortOrder: 0,
    isBuiltin: true,
    deletedAt: null,
  },
];

function renderIndex() {
  const onRenameCategory = vi.fn();
  const onResetCategory = vi.fn();
  render(
    <WikiIndex
      categories={categories}
      byCategory={new Map<string, EntryWithDetails[]>()}
      selectedId=""
      onSelect={() => {}}
      total={0}
      onCreateCategory={() => {}}
      onRenameCategory={onRenameCategory}
      onResetCategory={onResetCategory}
      onRequestDeleteCategory={() => {}}
      isRenamed={() => false}
      labelFor={() => "People"}
    />,
  );
  return { onRenameCategory, onResetCategory };
}

describe("WikiIndex inline rename (useInlineRename dedup via CategoryTitle)", () => {
  it("an UNCHANGED draft is a no-op: neither callback fires (resolveRename routing)", async () => {
    const user = userEvent.setup();
    const { onRenameCategory, onResetCategory } = renderIndex();

    await user.click(
      screen.getByRole("button", { name: "Rename People category" }),
    );
    // Commit with no edit — the draft still reads "People".
    await user.keyboard("{Enter}");

    expect(onRenameCategory).not.toHaveBeenCalled();
    expect(onResetCategory).not.toHaveBeenCalled();
  });

  it("a blank draft calls onResetCategory via resolveRename", async () => {
    const user = userEvent.setup();
    const { onRenameCategory, onResetCategory } = renderIndex();

    await user.click(
      screen.getByRole("button", { name: "Rename People category" }),
    );
    const input = screen.getByRole("textbox", {
      name: "Rename People category",
    });
    await user.clear(input);
    await user.keyboard("{Enter}");

    expect(onResetCategory).toHaveBeenCalledWith("people");
    expect(onRenameCategory).not.toHaveBeenCalled();
  });
});
