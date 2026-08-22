"use client";

import { useId, useState } from "react";
import type { ResearchThreadRow } from "@/lib/domain/types";
import ConfirmModal from "../ui/ConfirmModal";
import styles from "./ResearchIndex.module.css";

// TCK-HF2W-A2: replace the U+1F5D1 trash emoji on each thread's delete button with
// an inline SVG in the same register as WikiIndex's Chevron / DetailsColumn's
// Sparkle+Dismiss icons (viewBox 0 0 16 16, 1em box, stroke=currentColor,
// aria-hidden + focusable=false so it inherits the .trash colour token — --muted,
// --on-ink-muted on the active row, --accent-deep on hover — and stays decorative;
// the button's aria-label + title carry the meaning). Crisp and colour-consistent
// at any size, unlike the platform-dependent emoji glyph.
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 4 H13.5" />
      <path d="M6 4 V2.75 A0.75 0.75 0 0 1 6.75 2 H9.25 A0.75 0.75 0 0 1 10 2.75 V4" />
      <path d="M4 4 L4.6 13.1 A1 1 0 0 0 5.6 14 H10.4 A1 1 0 0 0 11.4 13.1 L12 4" />
      <path d="M6.5 7 V11" />
      <path d="M9.5 7 V11" />
    </svg>
  );
}

// A visible rename affordance (double-click still works, but a phone has no
// double-click and the gesture was undiscoverable). Same 16x16 stroke register
// as TrashIcon so the two row buttons read as a pair; decorative, the button's
// aria-label carries the meaning.
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11 2.5 L13.5 5 L5.5 13 L2.5 13.5 L3 10.5 Z" />
      <path d="M10 3.5 L12.5 6" />
    </svg>
  );
}

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
  onRename,
}: ResearchIndexProps) {
  const [open, setOpen] = useState(false);
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
              {onRename && editingId !== t.id ? (
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
              {onDelete && threads.length > 1 && editingId !== t.id ? (
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
          </li>
          );
        })}
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
