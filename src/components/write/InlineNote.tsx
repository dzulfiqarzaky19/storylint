'use client';

/**
 * InlineNote (HANDOFF §6/§8) — the note that opens under a paragraph when a
 * mark is selected. Rendered via React `createPortal` into the ProseMirror
 * widget host the decoration plugin places at the end of the paragraph, so it
 * sits in document flow rather than floating.
 *
 * Presentational only: it renders the engine's own `noteText` + `actions`
 * verbatim and calls back on click. The three actions are visually
 * differentiated (primary vs secondary) but their DIFFERENT behaviour lives in
 * the parent's `onAction` (leave / text / wiki).
 */

import type { Mark, MarkAction } from '@/lib/check';
import { railLabel } from '@/lib/check';
import styles from './Manuscript.module.css';

/**
 * The note's kind label uses the gazetteer voice from the Direction B
 * reference, derived from `mark.kind` (never hardcoded per mark).
 */
function noteKindLabel(mark: Mark): string {
  return mark.kind === 'conflict'
    ? 'Contradicts the gazetteer'
    : 'Not written down yet';
}

export interface InlineNoteProps {
  mark: Mark;
  /** Disable actions while a resolve is in flight. */
  busy?: boolean;
  onAction: (mark: Mark, action: MarkAction) => void;
}

export function InlineNote({ mark, busy, onAction }: InlineNoteProps) {
  const conflict = mark.kind === 'conflict';
  return (
    <div
      className={`${styles.note} ${conflict ? styles.noteConflict : styles.noteUnrecorded}`}
      data-testid="write-inline-note"
      // Keep clicks inside the note from bubbling to the editor's mark-click handler.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={`${styles.noteKind} ${conflict ? styles.noteKindConflict : styles.noteKindUnrecorded}`}
      >
        {noteKindLabel(mark)}
      </div>
      <div className={styles.noteText}>{mark.noteText}</div>
      <div className={styles.noteActions}>
        {mark.actions.map((action, i) => (
          <button
            key={action.id}
            type="button"
            className={`${styles.action} ${i === 0 ? styles.actionPrimary : styles.actionSecondary}`}
            disabled={busy}
            onClick={() => onAction(mark, action)}
          >
            {action.label}
          </button>
        ))}
      </div>
      {/* Screen-reader kind label as the mark's rail-label taxonomy. */}
      <span className="sr-only" aria-hidden>
        {railLabel(mark.kind)}
      </span>
    </div>
  );
}
