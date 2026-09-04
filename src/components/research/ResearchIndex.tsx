"use client";

import { useState } from "react";
import type { ResearchThreadRow } from "@/lib/domain/types";
import IndexRail from "@/components/shell/IndexRail";
import { PencilIcon, TrashIcon } from "@/components/shell/RowIcons";
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
  /** Commit an inline rename of a thread (double-click a row to edit its name). */
  onRename?: (id: string, title: string) => void;
}

/**
 * The Research LEFT index rail CONTENTS — a Gemini-style list of conversation
 * threads. One flat list (threads are not grouped), each row a title + a meta
 * subtitle; clicking one loads that thread.
 *
 * All rail CHROME (head, scroll containment, the <=1200px fold, ARIA, viewport
 * widths) belongs to the shared `IndexRail`; this module owns only the thread
 * rows and the "+ New thread" tail. See CONTEXT.md → Chrome → index rail.
 */
export default function ResearchIndex({
  threads,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: ResearchIndexProps) {
  // The thread whose name is being edited inline (double-click a row), or null.
  // Only one row edits at a time; committing/cancelling clears it back to null.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Optimistic rename overrides {threadId: newTitle}. The rendered title comes
  // from the server `threads` prop, refreshed via router.refresh() after the
  // rename persists — but that refresh is a round-trip that lags (and under
  // full-suite load can lag past a test's wait), so the row would briefly snap
  // back to the stale prop title. Mirroring the new title here shows it the
  // instant Enter commits, independent of refresh timing; once the refreshed
  // prop carries the same title the override is simply equal and harmless.
  const [renamed, setRenamed] = useState<Record<string, string>>({});
  // Thread pending deletion (title kept for the dialog copy), or null when the
  // danger ConfirmModal is closed. Replaces the raw window.confirm so the delete
  // reads as part of the app (matches the wiki's delete flows).
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);

  return (
    <>
      <IndexRail
        title="Threads"
        count={threads.length}
        ariaLabel="Research threads"
        toggleLabel="Toggle threads"
      >
        <ul className={styles.list}>
          {threads.map((t) => {
            const shownTitle = renamed[t.id] ?? t.title;
            return (
              <li key={t.id}>
                <div
                  className={
                    t.id === selectedId
                      ? `${styles.itemRow} ${styles.itemRowActive}`
                      : styles.itemRow
                  }
                >
                  {onRename && editingId === t.id ? (
                    <input
                      className={styles.rename}
                      aria-label="thread name"
                      defaultValue={shownTitle}
                      autoFocus
                      // Enter commits the rename; Escape abandons it. The row swaps
                      // back to a <button> either way (the spec's threadRows selector
                      // requires the committed row's first child to be a button).
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const next = e.currentTarget.value.trim();
                          if (next) {
                            setRenamed((m) => ({ ...m, [t.id]: next }));
                            onRename(t.id, next);
                          }
                          setEditingId(null);
                        } else if (e.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                      // Blur cancels rather than commits, so clicking away never
                      // silently overwrites the title with a half-typed value.
                      onBlur={() => setEditingId(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      className={
                        t.id === selectedId
                          ? `${styles.item} ${styles.itemActive}`
                          : styles.item
                      }
                      aria-current={t.id === selectedId ? "true" : undefined}
                      title={shownTitle}
                      onClick={() => onSelect(t.id)}
                      onDoubleClick={onRename ? () => setEditingId(t.id) : undefined}
                    >
                      <span className={styles.itemName}>{shownTitle}</span>
                      {t.subtitle ? (
                        <span className={styles.itemNote}>{t.subtitle}</span>
                      ) : null}
                    </button>
                  )}
                  {(onRename || (onDelete && threads.length > 1)) &&
                  editingId !== t.id ? (
                    <div className={styles.rowActions}>
                      {onRename ? (
                        <button
                          type="button"
                          className={styles.rowAction}
                          data-slot="rename"
                          aria-label={`Rename thread "${shownTitle}"`}
                          title="Rename thread"
                          onClick={() => setEditingId(t.id)}
                        >
                          <PencilIcon />
                        </button>
                      ) : null}
                      {onDelete && threads.length > 1 ? (
                        <button
                          type="button"
                          className={`${styles.rowAction} ${styles.trash}`}
                          aria-label={`Delete thread "${t.title}"`}
                          title="Delete thread"
                          onClick={() =>
                            setPendingDelete({ id: t.id, title: shownTitle })
                          }
                        >
                          <TrashIcon />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
          {onCreate ? (
            <li>
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
      </IndexRail>

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
    </>
  );
}
