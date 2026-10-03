'use client';

import type { Mark, MarkAction } from '@/domain/check';
import { railLabel } from '@/domain/check';
import styles from './Manuscript.module.css';

function noteKindLabel(mark: Mark): string {
  return mark.kind === 'conflict'
    ? 'Contradicts the gazetteer'
    : 'Not written down yet';
}

function isAiAction(action: MarkAction): boolean {
  return action.id === 'text' || action.id === 'edit';
}

export interface NoteAi {
  enabled: boolean;
  busy?: boolean;
  explanation?: string;
  rewrite?: string;
  error?: string;
  onExplain: () => void;
  onApplyRewrite?: (rewrite: string) => void;
}

export interface NoteProps {
  mark: Mark;
  busy?: boolean;
  onAction: (mark: Mark, action: MarkAction) => void;
  ai?: NoteAi;
}

export default function Note({ mark, busy, onAction, ai }: NoteProps) {
  const conflict = mark.kind === 'conflict';
  const showAi = ai?.enabled;
  const hasAdvice = Boolean(ai?.explanation || ai?.error);
  return (
    <div
      className={`${styles.note} ${conflict ? styles.noteConflict : styles.noteUnrecorded}`}
      data-testid="write-inline-note"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={`${styles.noteKind} ${conflict ? styles.noteKindConflict : styles.noteKindUnrecorded}`}
      >
        {noteKindLabel(mark)}
      </div>
      <div className={styles.noteText}>{mark.noteText}</div>
      <div className={styles.noteActions}>
        {mark.actions
          .filter((action) => showAi || (action.id !== 'text' && action.id !== 'edit'))
          .map((action, i) => (
            <button
              key={action.id}
              type="button"
              className={`${styles.action} ${i === 0 ? styles.actionPrimary : styles.actionSecondary}`}
              disabled={busy || (isAiAction(action) && ai?.busy)}
              onClick={() => onAction(mark, action)}
            >
              {isAiAction(action) && ai?.busy ? 'Asking…' : action.label}
            </button>
          ))}
      </div>
      {showAi && hasAdvice ? (
        <div className={styles.aiAdvice} data-testid="write-ai-advice">
          {ai?.error ? (
            <p className={styles.aiError}>{ai.error}</p>
          ) : (
            <>
              <p className={styles.aiExplanation}>{ai?.explanation}</p>
              {ai?.rewrite ? (
                <div className={styles.aiRewrite}>
                  <span className={styles.aiRewriteLabel}>Suggested rewrite</span>
                  <p className={styles.aiRewriteText}>“{ai.rewrite}”</p>
                  {ai.onApplyRewrite ? (
                    <button
                      type="button"
                      className={`${styles.action} ${styles.actionSecondary}`}
                      disabled={busy}
                      onClick={() => ai.onApplyRewrite?.(ai.rewrite ?? '')}
                      data-testid="write-ai-apply"
                    >
                      Use in editor
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      <span className="sr-only" aria-hidden>
        {railLabel(mark.kind)}
      </span>
    </div>
  );
}
