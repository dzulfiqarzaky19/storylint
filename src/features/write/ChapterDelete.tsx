"use client";

import { useEffect, useRef } from "react";
import styles from "./ChapterDelete.module.css";

export interface ChapterDeleteProps {
  /** The chapter number being deleted (drives the confirm copy). */
  number: number;
  /** The chapter title, shown so the writer confirms the right one. */
  title: string;
  /** Whether a delete request is in flight (disables the buttons). */
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A focused confirm gate for a destructive, irreversible delete: removing a
 * chapter drops its body and marks. The writer must name the exact chapter
 * ("chapter N: title") before it goes, so a mis-click on the sidebar icon can't
 * silently erase a chapter. Escape and the Cancel button both back out writing
 * nothing; only the explicit Delete confirms.
 */
export default function ChapterDelete({
  number,
  title,
  busy,
  onConfirm,
  onCancel,
}: ChapterDeleteProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  // Land focus on the confirm so a keyboard user can act without hunting, and
  // so Escape is captured by the dialog rather than the manuscript behind it.
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
