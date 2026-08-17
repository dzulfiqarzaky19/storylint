"use client";

import styles from "./ResearchScreen.module.css";

export interface KeptItemProps {
  kind: string;
  title: string;
}

/**
 * A row on the Kept board: kind, title, then the status line "On the board only"
 * (muted-2). Kept is the holding area for propositions NOT yet in the wiki — the
 * moment a card is written in it drops off the board (see ResearchScreen's
 * keptItems filter), so a kept row is never "in the wiki" and shows no such
 * badge. README §Screen 2.5.
 */
export default function KeptItem({ kind, title }: KeptItemProps) {
  return (
    <div className={styles.keptItem}>
      <div className={styles.keptKind}>{kind}</div>
      <div className={styles.keptTitle}>{title}</div>
      <div className={`${styles.keptState} ${styles.keptStateBoard}`}>
        On the board only
      </div>
    </div>
  );
}
