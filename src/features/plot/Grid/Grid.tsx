"use client";

import { useMemo, useState } from "react";
import type { PlotProgression, PlotLane } from "@/lib/db/plot";
import type { PlotEdit } from "../hooks/usePlotEdit";
import { LANE_COLORS, laneColor, statusLabel, longGapChapters, type Projection } from "../lib/plotModel";
import { Beat } from "./Beat";
import { BeatEditor } from "../components/BeatEditor";
import styles from "./Grid.module.css";

export function Grid({
  lanes,
  chapters,
  latestChapter,
  onOpen,
  edit,
  projection,
}: {
  lanes: PlotLane[];
  chapters: PlotProgression["chapters"];
  latestChapter: number;
  onOpen: (laneId: string) => void;
  edit: PlotEdit;
  projection: Projection;
}) {
  // The beat being dragged, keyed by lane + source chapter. A drag is HORIZONTAL
  // and lane-local: a card can only be dropped on an empty cell of its OWN lane
  // (feature 1), so the drop target checks laneId matches before accepting.
  const [drag, setDrag] = useState<{ laneId: string; from: number } | null>(null);
  // The empty cell currently being edited into a new beat (feature 2).
  const [adding, setAdding] = useState<{ laneId: string; chapter: number } | null>(null);

  // Fixed track widths (not 1fr) so the board scrolls horizontally past ~12
  // chapters instead of crushing beat cards below tap size on a long book.
  const cols = `var(--lane-col) repeat(${chapters.length}, var(--beat-col))`;

  // In chronology mode the column header carries the story-time label of the
  // earliest-ranked beat in that chapter (the same beat the reorder sorts on), so
  // a reader sees WHY a late chapter sits early. Keyed by chapter number.
  const chronoMode = projection === "arc";
  const chronoLabel = useMemo(() => {
    const label = new Map<number, string>();
    if (!chronoMode) return label;
    const rank = new Map<number, number>();
    for (const lane of lanes) {
      for (const beat of lane.beats) {
        if (beat.chronoOrder === 0 || beat.chronology === "") continue;
        const prev = rank.get(beat.chapterNumber);
        if (prev === undefined || beat.chronoOrder < prev) {
          rank.set(beat.chapterNumber, beat.chronoOrder);
          label.set(beat.chapterNumber, beat.chronology);
        }
      }
    }
    return label;
  }, [lanes, chronoMode]);

  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: cols }}
      role="grid"
      aria-label={chronoMode ? "Plot progression by story chronology" : "Plot progression by chapter"}
    >
      <div className={`${styles.corner} ${styles.headCell}`} role="columnheader">
        plotline &darr;&nbsp; {chronoMode ? "story-time" : "chapter"} &rarr;
      </div>
      {chapters.map((c) => {
        const chrono = chronoLabel.get(c.number);
        return (
          <div
            key={c.id}
            className={`${styles.chapHead} ${styles.headCell} ${
              c.number === latestChapter ? styles.here : ""
            }`}
            role="columnheader"
            title={chrono ? `${c.title} \u2014 ${chrono}` : c.title}
          >
            <span className={styles.chapNum}>Ch.{c.number}</span>
            <span className={styles.chapTitle}>{chrono ?? c.title}</span>
          </div>
        );
      })}

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
        const draggingHere = drag?.laneId === lane.id;
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
              <span className={styles.statusRow}>
                <span className={`${styles.status} ${styles[status.cls] ?? ""}`}>
                  {status.text}
                </span>
                <button
                  type="button"
                  className={styles.laneTrash}
                  aria-label={`Delete plotline ${lane.name}`}
                  title="Delete plotline"
                  disabled={edit.pending}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete plotline "${lane.name}"? Its beats are hidden with it.`)) {
                      edit.deleteLane(lane.id);
                    }
                  }}
                >
                  &#128465;
                </button>
              </span>
            </div>

            {chapters.map((c) => {
              const beat = byChapter.get(c.number);
              const isHere = c.number === latestChapter;
              const isEditing = adding?.laneId === lane.id && adding.chapter === c.number;
              if (beat) {
                return (
                  <div
                    key={c.id}
                    className={`${styles.cell} ${isHere ? styles.here : ""}`}
                    role="gridcell"
                  >
                    {isEditing ? (
                      <BeatEditor
                        initial={beat.summary}
                        pending={edit.pending}
                        onSave={(text) => {
                          edit.saveBeat(lane.id, c.number, text);
                          setAdding(null);
                        }}
                        onCancel={() => setAdding(null)}
                      />
                    ) : (
                      <Beat
                        beat={beat}
                        kind={lane.label}
                        color={color}
                        onOpen={() => setAdding({ laneId: lane.id, chapter: c.number })}
                        draggable={!edit.pending}
                        onDragStart={() => setDrag({ laneId: lane.id, from: c.number })}
                        onDragEnd={() => setDrag(null)}
                      />
                    )}
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
              // An empty cell is a drop target for THIS lane's dragged card, and
              // a click-to-add slot when idle. A pending write freezes both.
              const isGap = gaps.has(c.number);
              const dropTarget = draggingHere && drag.from !== c.number;
              return (
                <div
                  key={c.id}
                  className={`${styles.cell} ${styles.empty} ${
                    isGap ? styles.longgap : ""
                  } ${isHere ? styles.here : ""} ${dropTarget ? styles.dropTarget : ""}`}
                  role="gridcell"
                  aria-label={isGap ? `arc stalled at chapter ${c.number}` : undefined}
                  onDragOver={(e) => {
                    if (dropTarget) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (!dropTarget) return;
                    e.preventDefault();
                    edit.moveBeat(lane.id, drag.from, c.number);
                    setDrag(null);
                  }}
                >
                  {isEditing ? (
                    <BeatEditor
                      initial=""
                      pending={edit.pending}
                      onSave={(text) => {
                        edit.saveBeat(lane.id, c.number, text);
                        setAdding(null);
                      }}
                      onCancel={() => setAdding(null)}
                    />
                  ) : isGap ? (
                    <button
                      type="button"
                      className={styles.gapflag}
                      onClick={() => setAdding({ laneId: lane.id, chapter: c.number })}
                      disabled={edit.pending}
                    >
                      arc stalled
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.addBeat}
                      aria-label={`Add a beat to ${lane.name} at chapter ${c.number}`}
                      onClick={() => setAdding({ laneId: lane.id, chapter: c.number })}
                      disabled={edit.pending}
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
