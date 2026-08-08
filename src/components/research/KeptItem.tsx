"use client";

import styles from "./ResearchScreen.module.css";

export interface KeptItemProps {
  kind: string;
  title: string;
  inWiki: boolean;
}

/**
 * A row on the Kept board: kind, title, then a status line reading "On the board
 * only" (muted-2) or "In the wiki" (accent-deep) once written. README §Screen 2.5.
 */
export default function KeptItem({ kind, title, inWiki }: KeptItemProps) {
  return (
    <div className={styles.keptItem}>
      <div className={styles.keptKind}>{kind}</div>
      <div className={styles.keptTitle}>{title}</div>
      <div
        className={`${styles.keptState} ${
          inWiki ? styles.keptStateWiki : styles.keptStateBoard
        }`}
      >
        {inWiki ? "In the wiki" : "On the board only"}
      </div>
    </div>
  );
}
