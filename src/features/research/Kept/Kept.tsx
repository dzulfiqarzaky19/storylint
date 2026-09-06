"use client";

import { useId, useState } from "react";
import type { DragEvent } from "react";
import KeptItem from "./KeptItem";
import { Chevron } from "@/components/shell/RowIcons";
import styles from "./Kept.module.css";

export interface KeptEntry {
  id: string;
  kind: string;
  title: string;
  /** Source thread this card was kept in — the board is world-wide, so each row
   *  names its origin thread (attribution) and click-through targets it. */
  threadId: string;
  threadTitle: string;
}

export interface KeptProps {
  items: KeptEntry[];
  /** True while a card is dragged over the board (accent border + drop fill). */
  active: boolean;
  onDragOver: (ev: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (ev: DragEvent<HTMLDivElement>) => void;
  onDrop: (ev: DragEvent<HTMLDivElement>) => void;
  /** Open a kept item's source thread and focus its origin card (click-through). */
  onOpenItem: (item: KeptEntry) => void;
}

/**
 * The board filters (Wiki / Plot / Write). Only Wiki has content today; Plot and
 * Write are built-but-empty — the tab UI exists so the board can grow those
 * surfaces without a later structural change. Wiki is the default.
 */
const KEPT_TABS = ["Wiki", "Plot", "Write"] as const;
type KeptTab = (typeof KEPT_TABS)[number];

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
export default function Kept({
  items,
  active,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenItem,
}: KeptProps) {
  // Collapsible only matters in the stacked (mobile/tablet) layout. Default
  // closed so the phone opens on the thread, not the kept list (parity with
  // Write's rail). On desktop the toggle is hidden and the body always shows.
  const [open, setOpen] = useState(false);
  // The active board filter. Wiki is the only populated surface today; Plot and
  // Write are intentionally empty (built-but-empty is the correct state).
  const [tab, setTab] = useState<KeptTab>("Wiki");
  const bodyId = useId();
  return (
    <aside
      className={`${styles.boardWrap} ${open ? styles.boardExpanded : ""}`}
      aria-label="Kept"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Body (with the visible "Kept" title) is DOM-first so a
          `getByText("Kept").first()` resolves to the visible desktop title, not
          the toggle bar (`display:none` on desktop). On mobile the toggle is the
          collapsed bar and the body, when expanded, renders above it, so DOM
          order body then toggle matches that stacking. */}
      <div id={bodyId} className={styles.boardBody}>
        <div className={`${styles.board}${active ? ` ${styles.boardActive}` : ""}`}>
          <div className={styles.boardHead}>
            <span className={styles.boardTitle}>Kept</span>
            <span className={styles.boardSpacer} />
            <span className={styles.boardCount}>{items.length}</span>
          </div>
          <div className={styles.boardTabs} role="tablist" aria-label="Kept filter">
            {KEPT_TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`${styles.boardTab}${tab === t ? ` ${styles.boardTabActive}` : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab !== "Wiki" ? (
            <div className={styles.boardEmpty}>Nothing here yet.</div>
          ) : items.length === 0 ? (
            <div className={styles.boardEmpty}>
              Nothing kept yet. Drag a proposition here — kept things stay out of
              the gazetteer until you write them in.
            </div>
          ) : (
            items.map((k) => (
              <KeptItem
                key={k.id}
                kind={k.kind}
                title={k.title}
                threadTitle={k.threadTitle}
                onOpen={() => onOpenItem(k)}
              />
            ))
          )}
        </div>
      </div>

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
        {/* The shared Chevron, not a literal "+" / en-dash pair: the app has one
            disclosure glyph and both rails now draw it. */}
        <span
          className={`${styles.boardToggleChevron}${open ? ` ${styles.chevronOpen}` : ""}`}
          aria-hidden
        >
          <Chevron />
        </span>
      </button>
    </aside>
  );
}
