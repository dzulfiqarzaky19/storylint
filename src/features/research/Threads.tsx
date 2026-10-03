"use client";

import { useState } from "react";
import type { ResearchThreadRow } from "@/domain/types";
import IndexRail from "@/components/shell/IndexRail";
import { PencilIcon, TrashIcon } from "@/components/shell/RowIcons";
import { useInlineRename } from "@/hooks/useInlineRename";
import ConfirmModal from "@/components/ui/ConfirmModal";
import styles from "./Threads.module.css";

export interface ThreadsProps {
  threads: ResearchThreadRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
}

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

export default function Threads({
  threads,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: ThreadsProps) {
  const [renamed, setRenamed] = useState<Record<string, string>>({});
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
                        setRenamed((m) => ({ ...m, [id]: title }));
                        onRename(id, title);
                      }
                    : undefined
                }
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
