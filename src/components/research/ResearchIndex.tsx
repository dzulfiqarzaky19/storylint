"use client";

import { useState } from "react";
import type { ResearchThreadRow } from "@/lib/domain/types";
import IndexRail from "@/components/shell/IndexRail";
import { PencilIcon, TrashIcon } from "@/components/shell/RowIcons";
import { useInlineRename } from "@/components/hooks/useInlineRename";
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
 * One thread row. Its own component because the inline-rename hook is per-value:
 * each row owns a draft, and `useInlineRename` is the app's ONE rename shape
 * (shared with the wiki shelf, the wiki index rail and the plot drawer). This
 * used to be a fourth, hand-rolled copy of that shape with its own `editingId`
 * state and its own key handling.
 *
 * Blur CANCELS here rather than committing — a click-away must never write a
 * half-typed thread name — which is why it wires `cancel` and not `onBlur`.
 */
function ThreadRow({
  thread,
  shownTitle,
  selected,
  onSelect,
  onRename,
  onRequestDelete,
}: {
  thread: ResearchThreadRow;
  shownTitle: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onRequestDelete?: (id: string, title: string) => void;
}) {
  const rename = useInlineRename(shownTitle, {
    onCommit: (draft) => {
      const next = draft.trim();
      // A blank name is refused, not written: a thread always keeps a title.
      if (next) onRename?.(thread.id, next);
    },
  });

  return (
    <div
      className={
        selected ? `${styles.itemRow} ${styles.itemRowActive}` : styles.itemRow
      }
    >
      {rename.editing ? (
        <input
          className={styles.rename}
          aria-label="thread name"
          value={rename.draft}
          autoFocus
          onChange={(e) => rename.setDraft(e.target.value)}
          onKeyDown={rename.onKeyDown}
          onBlur={rename.cancel}
        />
      ) : (
        <button
          type="button"
          className={
            selected ? `${styles.item} ${styles.itemActive}` : styles.item
          }
          aria-current={selected ? "true" : undefined}
          title={shownTitle}
          onClick={() => onSelect(thread.id)}
          onDoubleClick={onRename ? () => rename.start(shownTitle) : undefined}
        >
          <span className={styles.itemName}>{shownTitle}</span>
          {thread.subtitle ? (
            <span className={styles.itemNote}>{thread.subtitle}</span>
          ) : null}
        </button>
      )}
      {(onRename || onRequestDelete) && !rename.editing ? (
        <div className={styles.rowActions}>
          {onRename ? (
            <button
              type="button"
              className={styles.rowAction}
              data-slot="rename"
              aria-label={`Rename thread "${shownTitle}"`}
              title="Rename thread"
              onClick={() => rename.start(shownTitle)}
            >
              <PencilIcon />
            </button>
          ) : null}
          {onRequestDelete ? (
            <button
              type="button"
              className={`${styles.rowAction} ${styles.trash}`}
              aria-label={`Delete thread "${thread.title}"`}
              title="Delete thread"
              onClick={() => onRequestDelete(thread.id, shownTitle)}
            >
              <TrashIcon />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
          {threads.map((t) => (
            <li key={t.id}>
              <ThreadRow
                thread={t}
                shownTitle={renamed[t.id] ?? t.title}
                selected={t.id === selectedId}
                onSelect={onSelect}
                onRename={
                  onRename
                    ? (id, title) => {
                        // Mirror the new title locally as well as sending it: the
                        // server prop only catches up after a router.refresh()
                        // round-trip, and until then the row would snap back.
                        setRenamed((m) => ({ ...m, [id]: title }));
                        onRename(id, title);
                      }
                    : undefined
                }
                // A book keeps at least one thread, so the last row has no delete.
                onRequestDelete={
                  onDelete && threads.length > 1
                    ? (id, title) => setPendingDelete({ id, title })
                    : undefined
                }
              />
            </li>
          ))}
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
