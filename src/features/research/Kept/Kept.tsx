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
  threadId: string;
  threadTitle: string;
}

export interface KeptProps {
  items: KeptEntry[];
  active: boolean;
  onDragOver: (ev: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (ev: DragEvent<HTMLDivElement>) => void;
  onDrop: (ev: DragEvent<HTMLDivElement>) => void;
  onOpenItem: (item: KeptEntry) => void;
}

const KEPT_TABS = ["Wiki", "Plot", "Write"] as const;
type KeptTab = (typeof KEPT_TABS)[number];

export default function Kept({
  items,
  active,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenItem,
}: KeptProps) {
  const [open, setOpen] = useState(false);
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
