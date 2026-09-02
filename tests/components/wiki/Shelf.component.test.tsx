import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Shelf from "@/components/wiki/shelf/Shelf";
import { DragProvider } from "@/components/dnd/DragContext";

// T-ARCH-7: Shelf.tsx's rename now dispatches through the shared
// useInlineRename hook (dedup, not unification). This locks Shelf's OWN
// quirk unchanged by the dedup: a BLANK committed draft calls
// onResetCategory (not onRenameCategory) — the reducer/backend trim ruling
// this site has always followed.

function renderShelf(overrides: Partial<React.ComponentProps<typeof Shelf>> = {}) {
  const onRenameCategory = vi.fn();
  const onResetCategory = vi.fn();
  render(
    <DragProvider>
      <Shelf
        shelf="people"
        categoryId="people"
        title="People"
        entries={[]}
        selectedId=""
        contradictions={new Set()}
        onSelect={() => {}}
        onDropEntry={() => {}}
        onDropFactOnEntry={() => {}}
        onRenameCategory={onRenameCategory}
        onResetCategory={onResetCategory}
        onRequestDeleteCategory={() => {}}
        isRenamed={false}
        isBuiltin={true}
        {...overrides}
      />
    </DragProvider>,
  );
  return { onRenameCategory, onResetCategory };
}

describe("Shelf inline rename (useInlineRename dedup)", () => {
  it("a blank committed draft calls onResetCategory, not onRenameCategory", async () => {
    const user = userEvent.setup();
    const { onRenameCategory, onResetCategory } = renderShelf();

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

  it("a changed non-blank draft calls onRenameCategory with the raw label", async () => {
    const user = userEvent.setup();
    const { onRenameCategory, onResetCategory } = renderShelf();

    await user.click(
      screen.getByRole("button", { name: "Rename People category" }),
    );
    const input = screen.getByRole("textbox", {
      name: "Rename People category",
    });
    await user.clear(input);
    await user.type(input, "Cast");
    await user.keyboard("{Enter}");

    expect(onRenameCategory).toHaveBeenCalledWith("people", "Cast");
    expect(onResetCategory).not.toHaveBeenCalled();
  });
});
