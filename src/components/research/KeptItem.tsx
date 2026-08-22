"use client";

import styles from "./ResearchScreen.module.css";

export interface KeptItemProps {
  kind: string;
  title: string;
  /** The thread this card was kept in — shown as "from <thread>" so a world-wide
   *  board (which aggregates every thread) stays attributable. */
  threadTitle: string;
  /** Open the source thread and focus the originating card. */
  onOpen: () => void;
}

/**
 * A row on the Kept board: kind, title, the "from <thread>" source-thread
 * attribution, then the status line "On the board only" (muted-2). The board is
 * WORLD-WIDE (aggregates kept propositions across every thread in the world), so
 * each row names which thread it came from and clicking it routes to that thread
 * and focuses the origin card. Kept holds propositions NOT yet in the wiki — the
 * moment a card is written in it drops off the board (see the keptItems filter),
 * so a kept row is never "in the wiki" and shows no such badge. README §Screen 2.5.
 */
export default function KeptItem({ kind, title, threadTitle, onOpen }: KeptItemProps) {
  return (
    <button type="button" className={styles.keptItem} onClick={onOpen}>
      <div className={styles.keptKind}>{kind}</div>
      <div className={styles.keptTitle}>{title}</div>
      <div className={styles.keptFrom}>from {threadTitle}</div>
      <div className={`${styles.keptState} ${styles.keptStateBoard}`}>
        On the board only
      </div>
    </button>
  );
}
