"use client";

import type { PlotBeat } from "@/lib/db/plot";
import styles from "./PlotScreen.module.css";

export function BeatCard({
  beat,
  kind,
  color,
  onOpen,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  beat: PlotBeat;
  kind: string;
  color: string;
  onOpen: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
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
      draggable={draggable}
      onDragStart={(e) => {
        // A payload is required for Firefox to start a drag; the real move data
        // lives in React state, this is just the enabling handshake.
        e.dataTransfer.setData("text/plain", "beat");
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
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
