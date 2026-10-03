import type { PlotProgression, PlotLane, PlotBeat } from "@/domain/plot";

export const LONG_GAP = 3;

export const LANE_COLORS = [
  "var(--lane-1)",
  "var(--lane-2)",
  "var(--lane-3)",
  "var(--lane-4)",
  "var(--lane-5)",
  "var(--lane-6)",
];

export const laneColor = (lane: PlotLane) =>
  LANE_COLORS[lane.colorIndex % LANE_COLORS.length]!;

export function statusLabel(lane: PlotLane, here: number): { cls: string; text: string } {
  if (lane.state === "resolved")
    return { cls: "done", text: `\u2713 resolved \u00b7 ch.${lane.resolvedAt}` };
  if (lane.state === "abandoned")
    return { cls: "abandoned", text: `dropped \u00b7 ch.${lane.resolvedAt}` };
  if (lane.lastAdvanced === null) return { cls: "idle", text: "not yet begun" };
  if (lane.state === "stalled")
    return { cls: "stalled", text: `\u26a0 stalled \u00b7 ${lane.neglect} chapters quiet` };
  if (lane.neglect <= 0)
    return { cls: "fresh", text: `advanced ch.${lane.lastAdvanced} \u00b7 current` };
  if (lane.neglect >= LONG_GAP)
    return { cls: "warm", text: `\u26a0 ${lane.neglect} chapters since it moved` };
  return { cls: "cool", text: `${lane.neglect} chapters since it moved` };
}

export function longGapChapters(lane: PlotLane): Set<number> {
  const filled = lane.beats.map((b) => b.chapterNumber).sort((a, b) => a - b);
  const flagged = new Set<number>();
  for (let i = 0; i < filled.length - 1; i++) {
    const from = filled[i]!;
    const to = filled[i + 1]!;
    if (to - from - 1 >= LONG_GAP) {
      for (let n = from + 1; n < to; n++) flagged.add(n);
    }
  }
  return flagged;
}

export type Row =
  | { kind: "beat"; chapterNumber: number; chapterTitle: string; beat: PlotBeat }
  | { kind: "stall"; from: number; to: number };

export function buildStoryRows(
  lane: PlotLane,
  chapters: PlotProgression["chapters"],
): Row[] {
  const gaps = longGapChapters(lane);
  const byChapter = new Map(lane.beats.map((b) => [b.chapterNumber, b]));
  const titleOf = new Map(chapters.map((c) => [c.number, c.title]));
  const rows: Row[] = [];
  let stallOpen = false;
  for (const c of chapters) {
    const beat = byChapter.get(c.number);
    if (beat) {
      stallOpen = false;
      rows.push({
        kind: "beat",
        chapterNumber: c.number,
        chapterTitle: titleOf.get(c.number) ?? "",
        beat,
      });
    } else if (gaps.has(c.number) && !stallOpen) {
      stallOpen = true;
      let end = c.number;
      while (gaps.has(end + 1)) end++;
      rows.push({ kind: "stall", from: c.number, to: end });
    }
  }
  return rows;
}
