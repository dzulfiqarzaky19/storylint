import { describe, it, expect } from "vitest";
import { resolveDanglingTies } from "@/lib/wiki/danglingTies";
import type { ResolvedTie, Kind } from "@/lib/domain/types";

// Minimal ResolvedTie factory. from/to ids + toName are the load-bearing fields
// for the resolver; rel/kind/catalogueNo are inert defaults that type-check.
function tie(
  id: string,
  fromEntryId: string,
  toEntryId: string,
  toName: string,
  kind: Kind = "character",
): ResolvedTie {
  return {
    id,
    fromEntryId,
    toEntryId,
    rel: "linked",
    toName,
    toKind: kind,
    toCatalogueNo: "",
  };
}

describe("resolveDanglingTies (F6-S2 — live-set membership)", () => {
  // LOCK (negative direction): a tie whose target is NOT in the live set is
  // tombstoned, carrying the removed target's name. Mutant that treats an absent
  // target as live (flips `!has` -> `has`) emits tombstoned=false here -> RED.
  it("tombstones a tie whose target is absent from the live set", () => {
    const live = new Set<string>(["a"]); // "b" was soft-deleted / purged
    const [r] = resolveDanglingTies(live, [tie("t1", "a", "b", "Bob")]);
    expect(r!.tombstoned).toBe(true);
    expect(r!.removedName).toBe("Bob");
  });

  // LOCK (positive direction): both endpoints live -> NOT tombstoned, no
  // removedName. Guarantees the negative test can't pass vacuously (a mutant
  // that always tombstones would fail HERE).
  it("does NOT tombstone a tie whose target is a live entry", () => {
    const live = new Set<string>(["a", "b"]);
    const [r] = resolveDanglingTies(live, [tie("t1", "a", "b", "Bob")]);
    expect(r!.tombstoned).toBe(false);
    expect(r!.removedName).toBeUndefined();
  });

  it("resolves each tie independently, preserving order and count", () => {
    const live = new Set<string>(["a", "b"]);
    const out = resolveDanglingTies(live, [
      tie("t1", "a", "b", "Bob"), // live
      tie("t2", "a", "gone", "Ghost"), // dangling
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]!.tombstoned).toBe(false);
    expect(out[1]!.tombstoned).toBe(true);
    expect(out[1]!.removedName).toBe("Ghost");
  });

  it("returns an empty array for no ties", () => {
    expect(resolveDanglingTies(new Set(["a"]), [])).toEqual([]);
  });
});
