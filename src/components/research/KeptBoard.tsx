"use client";

import { useId, useState } from "react";
import type { DragEvent } from "react";
import KeptItem from "./KeptItem";
import styles from "./ResearchScreen.module.css";

export interface KeptEntry {
  id: string;
  kind: string;
  title: string;
}

export interface KeptBoardProps {
  items: KeptEntry[];
  /** True while a card is dragged over the board (accent border + drop fill). */
  active: boolean;
  onDragOver: (ev: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (ev: DragEvent<HTMLDivElement>) => void;
  onDrop: (ev: DragEvent<HTMLDivElement>) => void;
}

/**
 * The Kept board — the right rail on Research (mirrors the Write screen's
 * "Two signals" rail for cross-screen uniformity). Transparent 2px border
 * turns accent (with drop fill) while a card is dragged over. Heading "KEPT" +
 * count, empty state, then kept items. README §Screen 2.5. Empty-state copy is
 * verbatim.
 *
 * Layout parity with Write: on desktop this is a standing right column; at
 * <=1200px it becomes a collapsible panel pinned to the bottom of the viewport,
 * opened/closed by the "KEPT" toggle bar. The toggle is hidden on desktop (the
 * body always shows) — see .boardToggle / .boardBody in the CSS.
 */
export default function KeptBoard({
  items,
  active,
  onDragOver,
  onDragLeave,
  onDrop,
}: KeptBoardProps) {
  // Collapsible only matters in the stacked (mobile/tablet) layout. Default
  // closed so the phone opens on the thread, not the kept list (parity with
  // Write's rail). On desktop the toggle is hidden and the body always shows.
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <aside
      className={`${styles.boardWrap} ${open ? styles.boardExpanded : ""}`}
      aria-label="Kept"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        type="button"
        className={styles.boardToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.boardToggleLabel}>
          Kept
          {items.length > 0 ? (
            <span className={styles.boardToggleCount}>{items.length}</span>
          ) : null}
        </span>
        <span className={styles.boardToggleChevron} aria-hidden>
          {open ? "\u2013" : "+"}
        </span>
      </button>

      <div id={bodyId} className={styles.boardBody}>
        <div className={`${styles.board}${active ? ` ${styles.boardActive}` : ""}`}>
          <div className={styles.boardHead}>
            <span className={styles.boardTitle}>Kept</span>
            <span className={styles.boardSpacer} />
            <span className={styles.boardCount}>{items.length}</span>
          </div>
          {items.length === 0 ? (
            <div className={styles.boardEmpty}>
              Nothing kept yet. Drag a proposition here — kept things stay out of
              the gazetteer until you write them in.
            </div>
          ) : (
            items.map((k) => (
              <KeptItem key={k.id} kind={k.kind} title={k.title} />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
