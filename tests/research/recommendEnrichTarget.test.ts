import { describe, it, expect } from "vitest";
import { recommendEnrichTarget } from "@/lib/research/recommendEnrichTarget";

// -----------------------------------------------------------------------------
// F6-S3a — recommendEnrichTarget (PURE). The load-bearing decision behind
// "enrich the existing entry, don't spawn a duplicate": given a research card
// and the LIVE entry list, pick the best existing entry to enrich, or null when
// no confident match. Excludes soft-deleted entries (never recommend a tombstone).
// -----------------------------------------------------------------------------

type LiveEntry = { id: string; name: string; kind: string; deletedAt?: number | null };

const towerWorld: LiveEntry = { id: "e-tower", name: "The Tower", kind: "world", deletedAt: null };
const maren: LiveEntry = { id: "e-maren", name: "Maren", kind: "character", deletedAt: null };

describe("recommendEnrichTarget", () => {
  it("recommends the existing tower entry for a 'tower' card", () => {
    const card = { title: "The Tower", body: "A black spire over Ashkeld." };
    const rec = recommendEnrichTarget(card, [towerWorld, maren]);
    expect(rec).toEqual({ entryId: "e-tower", name: "The Tower" });
  });

  it("matches case-insensitively and on a contained name", () => {
    const card = { title: "the tower at dusk", body: "..." };
    const rec = recommendEnrichTarget(card, [towerWorld, maren]);
    expect(rec).toEqual({ entryId: "e-tower", name: "The Tower" });
  });

  it("returns null when no entry confidently matches the card", () => {
    const card = { title: "A brand new order of knights", body: "..." };
    const rec = recommendEnrichTarget(card, [towerWorld, maren]);
    expect(rec).toBeNull();
  });

  it("EXCLUDES a soft-deleted namesake (never recommends a tombstone)", () => {
    const deletedTower: LiveEntry = { id: "e-tower", name: "The Tower", kind: "world", deletedAt: 1730000000000 };
    const card = { title: "The Tower", body: "..." };
    const rec = recommendEnrichTarget(card, [deletedTower, maren]);
    expect(rec).toBeNull();
  });

  it("prefers the longer, more specific name when several entries match", () => {
    const tower: LiveEntry = { id: "e-tower", name: "Tower", kind: "world", deletedAt: null };
    const brokenTower: LiveEntry = { id: "e-broken", name: "The Broken Tower", kind: "world", deletedAt: null };
    const card = { title: "The Broken Tower", body: "..." };
    const rec = recommendEnrichTarget(card, [tower, brokenTower]);
    expect(rec).toEqual({ entryId: "e-broken", name: "The Broken Tower" });
  });
});
