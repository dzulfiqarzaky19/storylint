"use client";

import { useId, useState } from "react";
import type { ResearchThreadRow } from "@/lib/domain/types";
import ConfirmModal from "../ui/ConfirmModal";
import styles from "./ResearchIndex.module.css";

export interface ResearchIndexProps {
  threads: ResearchThreadRow[];
  selectedId: string;
  /** Navigate to a thread (URL-driven; the screen pushes ?thread=<id>). */
  onSelect: (id: string) => void;
  /** Start a new (always free-context) thread. */
  onCreate?: () => void;
  /** Delete a thread (the screen confirms + handles active-thread navigation). */
  onDelete?: (id: string) => void;
}

/**
 * The Research LEFT sidebar — a Gemini-style list of conversation threads. One
 * flat list (threads are not grouped), each row a title + subtitle; clicking one
 * loads that thread. Shares the Wiki index's visual language (300px standing
 * rail on desktop; on the stacked tier <=1200px the whole list folds behind a
 * header toggle) so all three screens read as one app. The `open` state only
 * affects the stacked tier — on desktop `.panel` is always shown.
 */
export default function ResearchIndex({
  threads,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
}: ResearchIndexProps) {
  const [open, setOpen] = useState(false);
  // Thread pending deletion (title kept for the dialog copy), or null when the
  // danger ConfirmModal is closed. Replaces the raw window.confirm so the delete
  // reads as part of the app (matches the wiki's delete flows).
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const panelId = useId();

  return (
    <nav
      className={`${styles.index} ${open ? styles.indexOpen : ""}`}
      aria-label="Research threads"
    >
      <button
        type="button"
        className={styles.railToggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.title}>Threads</span>
        <span className={styles.count}>{threads.length}</span>
        <span className={styles.railToggleChevron} aria-hidden="true">
          {open ? "\u2212" : "+"}
        </span>
      </button>

      <ul id={panelId} className={styles.panel}>
        {threads.map((t) => (
          <li key={t.id}>
            <div
              className={
                t.id === selectedId
                  ? `${styles.itemRow} ${styles.itemRowActive}`
                  : styles.itemRow
              }
            >
              <button
                type="button"
                className={
                  t.id === selectedId
                    ? `${styles.item} ${styles.itemActive}`
                    : styles.item
                }
                aria-current={t.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(t.id)}
              >
                <span className={styles.itemName}>{t.title}</span>
                {t.subtitle ? (
                  <span className={styles.itemNote}>{t.subtitle}</span>
                ) : null}
              </button>
              {onDelete ? (
                <button
                  type="button"
                  className={styles.trash}
                  aria-label={`Delete thread "${t.title}"`}
                  title="Delete thread"
                  onClick={() => setPendingDelete({ id: t.id, title: t.title })}
                >
                  {"\uD83D\uDDD1"}
                </button>
              ) : null}
            </div>
          </li>
        ))}
        {onCreate ? (
          <li className={styles.createRow}>
            <button
              type="button"
              className={styles.add}
              onClick={() => onCreate()}
            >
              + New thread
            </button>
          </li>
        ) : null}
      </ul>

      {onDelete && pendingDelete ? (
        <ConfirmModal
          title={`Delete "${pendingDelete.title}"?`}
          body="This removes the thread and its research history. This cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          danger
          onConfirm={() => {
            onDelete(pendingDelete.id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </nav>
  );
}
