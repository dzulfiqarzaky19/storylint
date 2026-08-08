"use client";

import type { DragEvent } from "react";
import KeptItem from "./KeptItem";
import styles from "./ResearchScreen.module.css";

export interface KeptEntry {
  id: string;
  kind: string;
  title: string;
  inWiki: boolean;
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
 * The Kept board (340px). Transparent 2px border turns accent (with drop fill)
 * while a card is dragged over. Heading "KEPT" + count, empty state, then kept
 * items. README §Screen 2.5. Empty-state copy is verbatim.
 */
export default function KeptBoard({
  items,
  active,
  onDragOver,
  onDragLeave,
  onDrop,
}: KeptBoardProps) {
  return (
    <div
      className={styles.boardWrap}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
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
            <KeptItem key={k.id} kind={k.kind} title={k.title} inWiki={k.inWiki} />
          ))
        )}
      </div>
    </div>
  );
}
