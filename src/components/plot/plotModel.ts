// Pure /plot grid model — no React, no server deps. Extracted from PlotScreen
// (T-ARCH-11) so the lane-status / gap / story-row logic is unit-testable without
// mounting the grid. The screen and its sub-components import from here.
import type { PlotProgression, PlotLane, PlotBeat } from "@/lib/db/plot";

// Client-side mirror of the loader's LONG_GAP (src/lib/db/plot.ts). Redeclared
// (not imported) so this module never pulls the pg-backed loader — and its
// node-only deps (dns/fs/net/tls) — into the browser bundle. The loader already
// derives `stalled` from the same threshold; this only drives the visual long-gap
// run + the drawer's collapsed "went quiet" rows. Keep the two in sync.
export const LONG_GAP = 3;

// Six low-chroma arc hues, cycled by lane.colorIndex. The values live in
// globals.css (--lane-1..6) so a theme can restate them; here we only reference
// the tokens, never a hex, so the plot grid follows the active theme.
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

export type Projection = "chapter" | "arc";

/** The lane's status readout. A resolved/abandoned arc is DONE, not neglected, so
 *  it reports its cap; an open arc reports how long since it last moved (warm past
 *  LONG_GAP); a never-started lane reads "not yet begun". Mirrors the prototype. */
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

/** Chapters strictly between two consecutive beats that form a >= LONG_GAP run —
 *  the interior stall cells. A leading/trailing gap is not a sagging middle. */
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

/** Build the drawer's chapter-ordered "story so far": each beat is a row, and a
 *  run of >= LONG_GAP quiet chapters collapses into a single "went quiet" row so
 *  the sagging middle reads on the list too. Mirrors the prototype's openArc walk. */
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
