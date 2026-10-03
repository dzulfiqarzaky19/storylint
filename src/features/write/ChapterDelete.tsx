"use client";

import { useEffect, useRef } from "react";
import styles from "./ChapterDelete.module.css";

export interface ChapterDeleteProps {
  number: number;
  title: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ChapterDelete({
  number,
  title,
  busy,
  onConfirm,
  onCancel,
}: ChapterDeleteProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Delete chapter ${number}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className={styles.panel}>
        <h2 className={styles.title}>Delete this chapter?</h2>
        <p className={styles.body}>
          Are you sure you want to delete chapter {number}: {title}? This removes
          its text and cannot be undone.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={styles.confirm}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete chapter"}
          </button>
        </div>
      </div>
    </div>
  );
}
