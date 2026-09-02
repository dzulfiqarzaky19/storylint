import { describe, it, expect } from "vitest";
import {
  isEmptyCategory,
  initialCollapse,
  resolveRename,
} from "@/components/wiki/shelf/shelfState";

// The lighter empty-category treatment in Shelf.tsx (dimmed heading + a real
// "No entries yet" hint, controls kept) keys off THIS predicate. Shelf.tsx must
// call the same exported function, so a regression here moves the UI too.
describe("isEmptyCategory", () => {
  it("is true only when the category has zero entries", () => {
    expect(isEmptyCategory(0)).toBe(true);
  });

  it("is false for a populated category (one entry)", () => {
    expect(isEmptyCategory(1)).toBe(false);
  });

  it("is false for a many-entry category", () => {
    expect(isEmptyCategory(7)).toBe(false);
  });
});

// TCK-005 — the sidebar (WikiIndex) seeds its per-category collapse map from the
// live category ids via initialCollapse. Every group must start EXPANDED (false)
// so the whole world is scannable, and the map must cover EVERY id (built-in
// Kind strings + user UUIDs), so a regression here changes the sidebar's default
// open/closed state.
// Mutation-locked line in initialCollapse:
//  * `map[id] = false` — flip it to `true` and the "every group starts
//    expanded" assertion goes RED (a group would render collapsed by default).
describe("initialCollapse", () => {
  it("marks every category id as expanded (false) by default", () => {
    const map = initialCollapse(["people", "places", "lore", "cat-uuid-1"]);
    expect(map).toEqual({
      people: false,
      places: false,
      lore: false,
      "cat-uuid-1": false,
    });
  });

  it("returns one entry per id, all expanded, including user UUIDs", () => {
    const ids = ["orders", "a1b2c3"];
    const map = initialCollapse(ids);
    expect(Object.keys(map)).toEqual(ids);
    expect(Object.values(map).every((v) => v === false)).toBe(true);
  });

  it("is an empty map for no categories", () => {
    expect(initialCollapse([])).toEqual({});
  });
});

// TCK-018 — the wiki index consolidates each category's rename/reset/delete/+entry
// into one group-head cluster. WikiIndex.tsx's commitRename delegates the
// reset-vs-rename-vs-noop decision to resolveRename, then dispatches the matching
// callback (onResetCategory / onRenameCategory / nothing). A regression here moves
// the on-screen behavior of the consolidated rename control.
// Mutation-locked branches in resolveRename:
//  * M1 blank: `draft.trim() === ""` -> {reset}. Flip the branch and a
//    blank-draft commit would fall through to rename/noop instead of resetting
//    the built-in default (the "blank resets" assertion goes RED).
//  * M2 unchanged: the `draft.trim() !== currentTitle` guard returns {noop} when
//    equal. Drop the guard and an unchanged draft would emit a spurious rename
//    write (the "unchanged is a noop" assertion goes RED).
//  * M3 changed: returns {rename, label: draft} with the RAW draft (backend
//    trims). Change the payload and the "renames with the raw label" assertion
//    goes RED.
describe("resolveRename", () => {
  it("resets when the draft is blank (empty or whitespace-only)", () => {
    expect(resolveRename("", "People")).toEqual({ action: "reset" });
    expect(resolveRename("   ", "People")).toEqual({ action: "reset" });
  });

  it("is a noop when the trimmed draft equals the current title", () => {
    expect(resolveRename("People", "People")).toEqual({ action: "noop" });
    expect(resolveRename("  People  ", "People")).toEqual({ action: "noop" });
  });

  it("renames with the raw (untrimmed) label when the draft changed", () => {
    expect(resolveRename("Guilds", "People")).toEqual({
      action: "rename",
      label: "Guilds",
    });
  });

  it("preserves surrounding whitespace in the rename label (backend trims)", () => {
    expect(resolveRename("  Doomed  ", "People")).toEqual({
      action: "rename",
      label: "  Doomed  ",
    });
  });
});
