import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInlineRename } from "@/components/hooks/useInlineRename";

// T-ARCH-7 — the hook is the shared draft-state/key-dispatch shape behind
// wiki/Shelf.tsx, wiki/WikiIndex.tsx, and plot/PlotScreen.tsx's StoryDrawer
// inline rename. It does NOT decide what a commit means (blank-resets vs.
// no-op) — that stays each caller's own `onCommit`, so this only proves the
// hook's own contract: start seeds the draft and flips editing on; typing
// updates the draft; Enter commits with the raw draft and closes editing;
// Escape closes editing and calls onReset (never onCommit); blur commits.
describe("useInlineRename", () => {
  it("starts closed, with the draft seeded to the current value", () => {
    const { result } = renderHook(() =>
      useInlineRename("People", { onCommit: vi.fn() }),
    );
    expect(result.current.editing).toBe(false);
    expect(result.current.draft).toBe("People");
  });

  it("start(seed) opens editing and sets the draft from the seed", () => {
    const { result } = renderHook(() =>
      useInlineRename("People", { onCommit: vi.fn() }),
    );
    act(() => result.current.start("People"));
    expect(result.current.editing).toBe(true);
    expect(result.current.draft).toBe("People");
  });

  it("setDraft updates the draft while editing", () => {
    const { result } = renderHook(() =>
      useInlineRename("People", { onCommit: vi.fn() }),
    );
    act(() => result.current.start("People"));
    act(() => result.current.setDraft("Guilds"));
    expect(result.current.draft).toBe("Guilds");
  });

  it("Enter commits the RAW (untrimmed) draft and closes editing", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineRename("People", { onCommit }),
    );
    act(() => result.current.start("People"));
    act(() => result.current.setDraft("  Doomed  "));
    const preventDefault = vi.fn();
    act(() => result.current.onKeyDown({ key: "Enter", preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("  Doomed  ");
    expect(result.current.editing).toBe(false);
  });

  it("blur commits the draft (same as Enter) without a keyboard event", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineRename("People", { onCommit }),
    );
    act(() => result.current.start("People"));
    act(() => result.current.setDraft("Guilds"));
    act(() => result.current.onBlur());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Guilds");
    expect(result.current.editing).toBe(false);
  });

  it("Escape closes editing WITHOUT committing, and calls onReset if given", () => {
    const onCommit = vi.fn();
    const onReset = vi.fn();
    const { result } = renderHook(() =>
      useInlineRename("People", { onCommit, onReset }),
    );
    act(() => result.current.start("People"));
    act(() => result.current.setDraft("Guilds"));
    const preventDefault = vi.fn();
    act(() => result.current.onKeyDown({ key: "Escape", preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
    expect(onReset).toHaveBeenCalledOnce();
    expect(result.current.editing).toBe(false);
  });

  it("Escape works with no onReset given (PlotScreen has no reset path)", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineRename("Lane A", { onCommit }),
    );
    act(() => result.current.start("Lane A"));
    act(() =>
      result.current.onKeyDown({ key: "Escape", preventDefault: vi.fn() }),
    );
    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(false);
  });

  it("a commit while not editing is a no-op (guards a double-fire blur+Enter)", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineRename("People", { onCommit }),
    );
    // Never called start() -> editing stays false.
    act(() => result.current.onBlur());
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("keys other than Enter/Escape are ignored (no preventDefault, no commit)", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useInlineRename("People", { onCommit }),
    );
    act(() => result.current.start("People"));
    const preventDefault = vi.fn();
    act(() => result.current.onKeyDown({ key: "a", preventDefault }));
    expect(preventDefault).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(true);
  });
});
