"use client";

import { useState } from "react";
import type { PlotProgression, PlotLane } from "@/domain/plot";
import type { PlotEdit } from "../hooks/usePlotEdit";
import { laneColor, statusLabel, longGapChapters } from "../lib/plotModel";
import { Beat } from "./Beat";
import { BeatEditor } from "../components/BeatEditor";
import styles from "./Grid.module.css";

export function Grid({
  lanes,
  chapters,
  latestChapter,
  onOpen,
  edit,
}: {
  lanes: PlotLane[];
  chapters: PlotProgression["chapters"];
  latestChapter: number;
  onOpen: (laneId: string) => void;
  edit: PlotEdit;
}) {
  const [drag, setDrag] = useState<{ laneId: string; from: number } | null>(null);
  const [adding, setAdding] = useState<{ laneId: string; chapter: number } | null>(null);

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
