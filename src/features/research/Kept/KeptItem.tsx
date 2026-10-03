"use client";

import styles from "./Kept.module.css";

export interface KeptItemProps {
  kind: string;
  title: string;
  threadTitle: string;
  onOpen: () => void;
}

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
