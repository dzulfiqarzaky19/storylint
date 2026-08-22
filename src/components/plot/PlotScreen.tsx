"use client";

// The /plot grid: chapters (X) x plotlines (Y), a cell = the beat that advanced
// that arc in that chapter (spec's J.K. Rowling grid). Pure presentation over the
// server-assembled PlotProgression — no data fetching, no mutation. The neglect
// readout per lane makes the "sagging middle" (an arc gone quiet for many
// chapters) spatially visible, which is the whole reason /plot is its own surface.
import { useState } from "react";
import type { PlotProgression, PlotLane } from "@/lib/db/plot";
import styles from "./PlotScreen.module.css";

// A run of >= this many empty chapters BETWEEN two beats reads as a stall (the
// sagging middle). Matches the prototype's LONG_GAP so the signal is consistent.
const LONG_GAP = 3;

/** A beat summary may carry a trailing "  ⚠ <canon break>" the seed encodes; split
 *  it so the grid can render the warning distinctly from the beat prose. */
function splitWarning(summary: string): { text: string; warn: string | null } {
  const i = summary.indexOf("\u26a0");
  if (i === -1) return { text: summary, warn: null };
  return { text: summary.slice(0, i).trimEnd(), warn: summary.slice(i + 1).trim() };
}

/** The neglect label for a lane: current when it advanced in the latest chapter,
 *  else "N chapters since it moved" (warm when the gap is long). A lane with no
 *  beats hasn't started, so it reads "not yet begun" rather than "neglected". */
function neglectLabel(lane: PlotLane): { cls: string; text: string } {
  if (lane.lastAdvanced === null) return { cls: "idle", text: "not yet begun" };
  if (lane.neglect <= 0) return { cls: "fresh", text: `advanced ch.${lane.lastAdvanced} · current` };
  if (lane.neglect >= LONG_GAP)
    return { cls: "warm", text: `⚠ ${lane.neglect} chapters since it moved` };
  return { cls: "cool", text: `${lane.neglect} chapters since it moved` };
}

/** Chapters strictly between two consecutive beats that form a >= LONG_GAP run —
 *  the interior stall cells. A leading/trailing gap is not a sagging middle. */
function longGapChapters(lane: PlotLane): Set<number> {
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

type Selected = { lane: PlotLane; chapterNumber: number } | null;

export default function PlotScreen({
  progression,
}: {
  progression: PlotProgression;
}) {
  const { chapters, lanes } = progression;
  const [selected, setSelected] = useState<Selected>(null);

  const beatsTotal = lanes.reduce((s, l) => s + l.beats.length, 0);
  const stalled = lanes.filter((l) => l.neglect >= LONG_GAP).length;

  const selectedBeat =
    selected &&
    selected.lane.beats.find((b) => b.chapterNumber === selected.chapterNumber);

  if (lanes.length === 0) {
    return (
      <main className={styles.screen}>
        <header className={styles.head}>
          <p className={styles.kicker}>Plot</p>
          <h1 className={styles.title}>Nothing plotted yet</h1>
          <p className={styles.empty}>
            This world has no plotlines. Add a beat to a chapter and it appears
            here as an arc across the grid.
          </p>
        </header>
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <header className={styles.head}>
        <p className={styles.kicker}>Plot</p>
        <h1 className={styles.title}>Plot progression</h1>
        <p className={styles.sub}>
          {lanes.length} plotlines · {beatsTotal} beats · {chapters.length}{" "}
          chapters
          {stalled > 0 ? (
            <span className={styles.subWarn}> · {stalled} stalled</span>
          ) : null}
        </p>
      </header>

      <div className={styles.gridWrap}>
        <PlotGrid lanes={lanes} chapters={chapters} onSelect={setSelected} />
      </div>

      {selected && selectedBeat ? (
        <BeatDrawer
          lane={selected.lane}
          chapterNumber={selected.chapterNumber}
          summary={selectedBeat.summary}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </main>
  );
}

function PlotGrid({
  lanes,
  chapters,
  onSelect,
}: {
  lanes: PlotLane[];
  chapters: PlotProgression["chapters"];
  onSelect: (s: { lane: PlotLane; chapterNumber: number }) => void;
}) {
  // One grid column per chapter after the sticky lane-label column. Fixed track
  // widths (not 1fr) so the grid scrolls horizontally past ~12 chapters instead
  // of crushing cells below tap size on a 42-chapter book.
  const cols = `var(--lane-col) repeat(${chapters.length}, var(--beat-col))`;
  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: cols }}
      role="grid"
      aria-label="Plot progression by chapter"
    >
      <div className={`${styles.corner} ${styles.headCell}`} role="columnheader">
        Plotline
      </div>
      {chapters.map((c) => (
        <div
          key={c.id}
          className={`${styles.chapHead} ${styles.headCell}`}
          role="columnheader"
          title={c.title}
        >
          <span className={styles.chapNum}>{c.number}</span>
          <span className={styles.chapTitle}>{c.title}</span>
        </div>
      ))}

      {lanes.map((lane) => {
        const gaps = longGapChapters(lane);
        const nl = neglectLabel(lane);
        const byChapter = new Map(lane.beats.map((b) => [b.chapterNumber, b]));
        return (
          <div key={lane.id} className={styles.laneRow} role="row">
            <div className={styles.laneLabel} role="rowheader">
              <span className={styles.laneName}>{lane.name}</span>
              <span className={styles.laneMeta}>
                {lane.ownerName ?? "no owner"}
              </span>
              <span className={`${styles.neglect} ${styles[nl.cls]}`}>
                {nl.text}
              </span>
            </div>
            {chapters.map((c) => {
              const beat = byChapter.get(c.number);
              const isGap = gaps.has(c.number);
              if (!beat) {
                return (
                  <div
                    key={c.id}
                    className={`${styles.cell} ${isGap ? styles.gap : styles.blank}`}
                    role="gridcell"
                    aria-label={isGap ? `stalled at chapter ${c.number}` : undefined}
                  />
                );
              }
              const { warn } = splitWarning(beat.summary);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.cell} ${styles.beat} ${warn ? styles.beatWarn : ""}`}
                  onClick={() => onSelect({ lane, chapterNumber: c.number })}
                  role="gridcell"
                  title={splitWarning(beat.summary).text}
                >
                  <span className={styles.dot} aria-hidden />
                  {warn ? <span className={styles.flag}>⚠</span> : null}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function BeatDrawer({
  lane,
  chapterNumber,
  summary,
  onClose,
}: {
  lane: PlotLane;
  chapterNumber: number;
  summary: string;
  onClose: () => void;
}) {
  const { text, warn } = splitWarning(summary);
  return (
    <div
      className={styles.drawerScrim}
      role="dialog"
      aria-modal="true"
      aria-label={`${lane.name}, chapter ${chapterNumber}`}
      onClick={onClose}
    >
      <aside className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.drawerClose} onClick={onClose}>
          Close
        </button>
        <p className={styles.drawerKicker}>Chapter {chapterNumber}</p>
        <h2 className={styles.drawerTitle}>{lane.name}</h2>
        <p className={styles.drawerOwner}>{lane.ownerName ?? "no owner"}</p>
        <p className={styles.drawerBody}>{text}</p>
        {warn ? <p className={styles.drawerWarn}>⚠ {warn}</p> : null}
      </aside>
    </div>
  );
}
