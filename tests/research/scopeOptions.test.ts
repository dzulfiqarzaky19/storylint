import { describe, it, expect } from "vitest";
import { availableScopeOptions } from "@/lib/research/scopeOptions";
import type { EntryWithDetails, Kind } from "@/lib/domain/types";

function entry(id: string, kind: Kind): EntryWithDetails {
  return {
    id,
    kind,
    name: id,
    catalogueNo: "",
    note: "",
    summary: "",
    shelf: "people",
    sortOrder: 0,
    facts: [],
    ties: [],
    appearances: [],
    openQuestions: [],
  };
}

describe("availableScopeOptions", () => {
  it("always lists Chat FIRST", () => {
    const opts = availableScopeOptions([]);
    expect(opts[0]).toEqual({ value: "chat", label: "Chat" });
  });

  it("with no entries, returns ONLY the Chat option (all kinds empty -> hidden)", () => {
    expect(availableScopeOptions([])).toEqual([{ value: "chat", label: "Chat" }]);
  });

  it("shows a kind with >=1 entry and HIDES kinds with zero entries", () => {
    const opts = availableScopeOptions([entry("c1", "character")]);
    expect(opts).toEqual([
      { value: "chat", label: "Chat" },
      { value: "character", label: "People" },
    ]);
  });

  it("maps each kind to its scope label (People/Places/Orders/Lore)", () => {
    const opts = availableScopeOptions([
      entry("c1", "character"),
      entry("w1", "world"),
      entry("o1", "organization"),
      entry("l1", "lore"),
    ]);
    expect(opts).toEqual([
      { value: "chat", label: "Chat" },
      { value: "character", label: "People" },
      { value: "world", label: "Places" },
      { value: "organization", label: "Orders" },
      { value: "lore", label: "Lore" },
    ]);
  });

  it("counts multiple entries of a kind as still one option", () => {
    const opts = availableScopeOptions([
      entry("c1", "character"),
      entry("c2", "character"),
      entry("c3", "character"),
    ]);
    expect(opts).toEqual([
      { value: "chat", label: "Chat" },
      { value: "character", label: "People" },
    ]);
  });

  it("emits kinds in canonical order regardless of entry insertion order", () => {
    const opts = availableScopeOptions([
      entry("l1", "lore"),
      entry("c1", "character"),
      entry("o1", "organization"),
    ]);
    expect(opts.map((o) => o.value)).toEqual([
      "chat",
      "character",
      "organization",
      "lore",
    ]);
  });
});
