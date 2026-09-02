import { describe, it, expect } from "vitest";
import {
  statusLabel,
  longGapChapters,
  buildStoryRows,
  laneColor,
  LANE_COLORS,
  LONG_GAP,
} from "@/components/plot/plotModel";
import type { PlotLane, PlotBeat, PlotChapter } from "@/lib/db/plot";

// Minimal fixtures. The pure model only reads a handful of fields; the rest are
// filled to satisfy the type. These tests are the payoff of the T-ARCH-11 split:
// the grid's status / gap / story-row logic is now exercised without React.

function beat(chapterNumber: number, over: Partial<PlotBeat> = {}): PlotBeat {
  return {
    chapterNumber,
    summary: `beat ${chapterNumber}`,
    warn: null,
    resolves: false,
    abandons: false,
    chronoOrder: 0,
    chronology: "",
    ...over,
  };
}

function lane(over: Partial<PlotLane> = {}): PlotLane {
  return {
    id: "l1",
    name: "Iron Key",
    label: "main story",
    ownerName: null,
    beats: [],
    lastAdvanced: null,
    neglect: 0,
    state: "open",
    resolvedAt: null,
    colorIndex: 0,
    ...over,
  };
}

function chapters(n: number): PlotChapter[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    number: i + 1,
    title: `Chapter ${i + 1}`,
  }));
}

describe("laneColor", () => {
  it("cycles the six lane tokens by colorIndex", () => {
    expect(laneColor(lane({ colorIndex: 0 }))).toBe(LANE_COLORS[0]);
    expect(laneColor(lane({ colorIndex: 7 }))).toBe(LANE_COLORS[1]); // 7 % 6 = 1
  });
});

describe("statusLabel", () => {
  it("reports a resolved arc at its cap, not as neglected", () => {
    const s = statusLabel(lane({ state: "resolved", resolvedAt: 12 }), 20);
    expect(s.cls).toBe("done");
    expect(s.text).toContain("resolved");
    expect(s.text).toContain("12");
  });

  it("reads 'not yet begun' for a lane with no advance", () => {
    expect(statusLabel(lane({ lastAdvanced: null }), 5).cls).toBe("idle");
  });

  it("goes warm once neglect crosses LONG_GAP", () => {
    const warm = statusLabel(lane({ lastAdvanced: 1, neglect: LONG_GAP }), 10);
    expect(warm.cls).toBe("warm");
    const cool = statusLabel(lane({ lastAdvanced: 3, neglect: LONG_GAP - 1 }), 10);
    expect(cool.cls).toBe("cool");
  });

  it("marks a fresh (neglect 0) advance current", () => {
    expect(statusLabel(lane({ lastAdvanced: 9, neglect: 0 }), 9).cls).toBe("fresh");
  });
});

describe("longGapChapters", () => {
  it("flags only the interior of a >= LONG_GAP run between two beats", () => {
    // beats at 1 and 6 -> interior 2,3,4,5 (gap of 4 >= LONG_GAP)
    const g = longGapChapters(lane({ beats: [beat(1), beat(6)] }));
    expect([...g].sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
  });

  it("does not flag a gap shorter than LONG_GAP", () => {
    // beats at 1 and 3 -> interior is just 2 (gap of 2 < LONG_GAP=3)
    expect(longGapChapters(lane({ beats: [beat(1), beat(3)] })).size).toBe(0);
  });

  it("ignores leading/trailing gaps (only between beats counts)", () => {
    const g = longGapChapters(lane({ beats: [beat(5)] }));
    expect(g.size).toBe(0);
  });
});

describe("buildStoryRows", () => {
  it("emits one beat row per beat in chapter order", () => {
    const rows = buildStoryRows(lane({ beats: [beat(1), beat(2)] }), chapters(2));
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === "beat")).toBe(true);
  });

  it("collapses a long quiet run into a single stall row spanning it", () => {
    const rows = buildStoryRows(lane({ beats: [beat(1), beat(6)] }), chapters(6));
    const stalls = rows.filter((r) => r.kind === "stall");
    expect(stalls).toHaveLength(1);
    expect(stalls[0]).toMatchObject({ kind: "stall", from: 2, to: 5 });
  });

  it("carries the chapter title onto each beat row", () => {
    const rows = buildStoryRows(lane({ beats: [beat(2)] }), chapters(3));
    const beatRow = rows.find((r) => r.kind === "beat");
    expect(beatRow).toMatchObject({ chapterNumber: 2, chapterTitle: "Chapter 2" });
  });
});
