"use client";

// The /plot timeline: chapters (X) x plotlines (Y). Each cell is a beat CARD (the
// beat prose + arc kind), not a dot — the grid is meant to be READ, so a neglected
// arc's silence and a resolved arc's payoff are both visible at a glance. Pure
// presentation over the server-assembled PlotProgression: no fetching, no mutation.
// Feature parity with prototypes/plot.{html,js} (the design source of truth).
import { useEffect, useMemo, useRef, useState } from "react";
import type { PlotProgression, PlotLane, PlotBeat } from "@/lib/db/plot";
import styles from "./PlotScreen.module.css";

// Client-side mirror of the loader's LONG_GAP (src/lib/db/plot.ts). Redeclared
// (not imported) so this "use client" module never pulls the pg-backed loader —
// and its node-only deps (dns/fs/net/tls) — into the browser bundle. The loader
// already derives `stalled` from the same threshold; this only drives the visual
// long-gap run + the drawer's collapsed "went quiet" rows. Keep the two in sync.
const LONG_GAP = 3;

// Six low-chroma arc hues, cycled by lane.colorIndex. Kept inside the Ashkeld
// palette (prototype --lane-a..d) so the grid never turns into a rainbow.
const LANE_COLORS = ["#2f6f6a", "#b5561f", "#3a4f8a", "#7a6a2f", "#5b3a6a", "#2f5a8a"];
const laneColor = (lane: PlotLane) => LANE_COLORS[lane.colorIndex % LANE_COLORS.length]!;

/** The lane's status readout. A resolved/abandoned arc is DONE, not neglected, so
 *  it reports its cap; an open arc reports how long since it last moved (warm past
 *  LONG_GAP); a never-started lane reads "not yet begun". Mirrors the prototype. */
function statusLabel(lane: PlotLane, here: number): { cls: string; text: string } {
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

type Projection = "chapter" | "arc";

export default function PlotScreen({
  progression,
}: {
  progression: PlotProgression;
}) {
  const { chapters, lanes, latestChapter, completion } = progression;
  const [projection, setProjection] = useState<Projection>("chapter");
  const [openLaneId, setOpenLaneId] = useState<string | null>(null);

  // "by character arc" re-sorts lanes most-neglected-first so the arcs that have
  // gone quiet surface to the top; "by chapter" keeps the natural (seeded) order.
  const orderedLanes = useMemo(() => {
    if (projection === "chapter") return lanes;
    return [...lanes].sort((a, b) => b.neglect - a.neglect);
  }, [lanes, projection]);

  const openLane = lanes.find((l) => l.id === openLaneId) ?? null;

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
      <div className={styles.toolbar}>
        <div className={styles.proj}>
          <span className={styles.projLabel}>timeline by</span>
          <div className={styles.seg} role="group" aria-label="Projection">
            <button
              type="button"
              aria-pressed={projection === "chapter"}
              onClick={() => setProjection("chapter")}
            >
              chapter
            </button>
            <button
              type="button"
              aria-pressed={projection === "arc"}
              onClick={() => setProjection("arc")}
            >
              character arc
            </button>
          </div>
        </div>

        <CompletionMeter completion={completion} />

        <div className={styles.legend}>
          <span>
            <i className={styles.legendBar} style={{ background: LANE_COLORS[0] }} /> arc advanced
          </span>
          <span>
            <i className={styles.legendWarn} /> breaks canon
          </span>
          <span>
            <i className={styles.legendGap} /> gap &mdash; arc went quiet
          </span>
        </div>
      </div>

      <section className={styles.board} aria-label="Plot timeline">
        <PlotGrid
          lanes={orderedLanes}
          chapters={chapters}
          latestChapter={latestChapter}
          onOpen={setOpenLaneId}
        />
      </section>

      {openLane ? (
        <StoryDrawer
          lane={openLane}
          chapters={chapters}
          latestChapter={latestChapter}
          onClose={() => setOpenLaneId(null)}
        />
      ) : null}
    </main>
  );
}

function CompletionMeter({
  completion,
}: {
  completion: PlotProgression["completion"];
}) {
  const { resolved, owed, percent } = completion;
  const tail = owed > 0 && resolved === owed ? " \u00b7 all arcs landed" : "";
  return (
    <div className={styles.meter} aria-live="polite">
      <span className={styles.meterBar}>
        <i style={{ width: `${percent}%` }} />
      </span>
      <span>
        <b>
          {resolved} of {owed}
        </b>{" "}
        arcs landed{tail}
      </span>
    </div>
  );
}

function PlotGrid({
  lanes,
  chapters,
  latestChapter,
  onOpen,
}: {
  lanes: PlotLane[];
  chapters: PlotProgression["chapters"];
  latestChapter: number;
  onOpen: (laneId: string) => void;
}) {
  // Fixed track widths (not 1fr) so the board scrolls horizontally past ~12
  // chapters instead of crushing beat cards below tap size on a long book.
  const cols = `var(--lane-col) repeat(${chapters.length}, var(--beat-col))`;
  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: cols }}
      role="grid"
      aria-label="Plot progression by chapter"
    >
      <div className={`${styles.corner} ${styles.headCell}`} role="columnheader">
        plotline &darr;&nbsp; chapter &rarr;
      </div>
      {chapters.map((c) => (
        <div
          key={c.id}
          className={`${styles.chapHead} ${styles.headCell} ${
            c.number === latestChapter ? styles.here : ""
          }`}
          role="columnheader"
          title={c.title}
        >
          <span className={styles.chapNum}>Ch.{c.number}</span>
          <span className={styles.chapTitle}>{c.title}</span>
        </div>
      ))}

      {lanes.map((lane) => {
        const gaps = longGapChapters(lane);
        const status = statusLabel(lane, latestChapter);
        const byChapter = new Map(lane.beats.map((b) => [b.chapterNumber, b]));
        // Cells after a closed arc's cap are the greyed "past" tail (done, not quiet).
        const cap =
          lane.state === "resolved" || lane.state === "abandoned"
            ? lane.resolvedAt
            : null;
        const color = laneColor(lane);
        return (
          <div key={lane.id} className={styles.laneRow} role="row">
            <div
              className={styles.laneLabel}
              role="rowheader"
              tabIndex={0}
              aria-label={`Open ${lane.name} story so far`}
              onClick={() => onOpen(lane.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(lane.id);
                }
              }}
            >
              <span className={styles.laneName}>
                <span className={styles.swatch} style={{ background: color }} />
                {lane.name}
              </span>
              <span className={styles.laneKind}>{lane.label}</span>
              {lane.ownerName ? (
                <span className={styles.laneOwner}>{lane.ownerName}</span>
              ) : null}
              <span className={`${styles.status} ${styles[status.cls] ?? ""}`}>
                {status.text}
              </span>
            </div>

            {chapters.map((c) => {
              const beat = byChapter.get(c.number);
              const isHere = c.number === latestChapter;
              if (beat) {
                return (
                  <div
                    key={c.id}
                    className={`${styles.cell} ${isHere ? styles.here : ""}`}
                    role="gridcell"
                  >
                    <BeatCard
                      beat={beat}
                      kind={lane.label}
                      color={color}
                      onOpen={() => onOpen(lane.id)}
                    />
                  </div>
                );
              }
              if (cap !== null && c.number > cap) {
                return (
                  <div
                    key={c.id}
                    className={`${styles.cell} ${styles.past} ${isHere ? styles.here : ""}`}
                    role="gridcell"
                  />
                );
              }
              const isGap = gaps.has(c.number);
              return (
                <div
                  key={c.id}
                  className={`${styles.cell} ${styles.empty} ${
                    isGap ? styles.longgap : ""
                  } ${isHere ? styles.here : ""}`}
                  role="gridcell"
                  aria-label={isGap ? `arc stalled at chapter ${c.number}` : undefined}
                >
                  {isGap ? <span className={styles.gapflag}>arc stalled</span> : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function BeatCard({
  beat,
  kind,
  color,
  onOpen,
}: {
  beat: PlotBeat;
  kind: string;
  color: string;
  onOpen: () => void;
}) {
  const capped = beat.resolves || beat.abandons;
  return (
    <button
      type="button"
      className={`${styles.beatcard} ${beat.warn ? styles.broken : ""} ${
        capped ? styles.capped : ""
      } ${beat.abandons ? styles.abandoned : ""}`}
      style={{ ["--lane" as string]: color }}
      onClick={onOpen}
    >
      <span className={styles.beatText}>{beat.summary}</span>
      <span className={styles.beatMeta}>
        <span className={styles.beatKind}>{kind}</span>
      </span>
      {beat.resolves ? (
        <span className={styles.capnote}>&#10003; arc resolved here</span>
      ) : beat.abandons ? (
        <span className={styles.capnote}>arc dropped here</span>
      ) : null}
      {beat.warn ? (
        <span className={styles.beatWarn}>
          <span className={styles.glyph}>&#9888;</span>
          {beat.warn}
        </span>
      ) : null}
    </button>
  );
}

type Row =
  | { kind: "beat"; chapterNumber: number; chapterTitle: string; beat: PlotBeat }
  | { kind: "stall"; from: number; to: number };

/** Build the drawer's chapter-ordered "story so far": each beat is a row, and a
 *  run of >= LONG_GAP quiet chapters collapses into a single "went quiet" row so
 *  the sagging middle reads on the list too. Mirrors the prototype's openArc walk. */
function buildStoryRows(
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

function StoryDrawer({
  lane,
  chapters,
  latestChapter,
  onClose,
}: {
  lane: PlotLane;
  chapters: PlotProgression["chapters"];
  latestChapter: number;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = buildStoryRows(lane, chapters);
  const status = statusLabel(lane, latestChapter);
  const color = laneColor(lane);
  const pill =
    lane.state === "resolved"
      ? `\u2713 resolved \u00b7 ch.${lane.resolvedAt}`
      : lane.state === "abandoned"
        ? `dropped \u00b7 ch.${lane.resolvedAt}`
        : lane.state === "stalled"
          ? "stalled"
          : null;

  return (
    <div className={styles.scrim} onClick={onClose} data-open="true">
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={`Story so far, ${lane.name}`}
        style={{ ["--lane" as string]: color }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dhead}>
          <div className={styles.dtitle}>
            <h2>Story so far &mdash; {lane.name}</h2>
            <button
              ref={closeRef}
              type="button"
              className={styles.dclose}
              aria-label="Close"
              onClick={onClose}
            >
              &times;
            </button>
          </div>
          <span className={styles.dkind}>{lane.label}</span>
          <span className={styles.dsub}>
            {pill ? <span className={styles.pill}>{pill}</span> : null}
            {status.text}
          </span>
        </div>

        <div className={styles.beatlist}>
          {rows.map((r) =>
            r.kind === "beat" ? (
              <div
                key={`b${r.chapterNumber}`}
                className={`${styles.beatrow} ${r.beat.warn ? styles.broken : ""}`}
              >
                <div className={styles.rowCh}>
                  Ch.{r.chapterNumber}
                  <small>{r.chapterTitle}</small>
                </div>
                <div className={styles.rowBody}>
                  {r.beat.summary}
                  {r.beat.warn ? (
                    <div className={styles.rowWarn}>
                      <span className={styles.glyph}>&#9888;</span>
                      {r.beat.warn}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div key={`s${r.from}`} className={`${styles.beatrow} ${styles.stall}`}>
                <div className={styles.rowCh}>
                  Ch.{r.from}
                  {r.to > r.from ? `\u2013${r.to}` : ""}
                </div>
                <div className={styles.rowBody}>
                  arc went quiet &mdash; {r.to - r.from + 1} chapters with no beat
                </div>
              </div>
            ),
          )}
        </div>
      </aside>
    </div>
  );
}
