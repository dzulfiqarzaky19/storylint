'use client';

/**
 * Manuscript — the chapter page: title, editor, inline note, save state.
 * Former manuscript column of the Write screen.
 */

import { createPortal } from 'react-dom';
import { EditorContent, type Editor } from '@tiptap/react';
import type { Mark, MarkAction } from '@/lib/check';
import Note from './Note';
import SaveState from './SaveState';
import Title from './Title';
import styles from './Manuscript.module.css';

export interface ManuscriptProps {
  chapterNumber: number;
  chapterTitle: string;
  activeBookId: string;
  editor: Editor | null;
  onRename: (n: number, title: string) => void;
  error: string | null;
  dirty: boolean;
  aiChecking: boolean;
  openMark: Mark | null;
  noteHost: HTMLElement | null;
  busy: boolean;
  onAction: (mark: Mark, action: MarkAction) => void;
  aiEnabled: boolean;
  aiBusyKey: string | null;
  aiAdvice: Record<string, { explanation: string; rewrite: string; error?: string }>;
  onExplain: (mark: Mark) => void;
  onApplyRewrite: (mark: Mark, rewrite: string) => void;
}

/** Spell small chapter numbers for the eyebrow ("Chapter seven"). */
function numberWord(n: number): string {
  const words = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
    'nine', 'ten', 'eleven', 'twelve',
  ];
  return words[n] ?? String(n);
}

export default function Manuscript({
  chapterNumber,
  chapterTitle,
  activeBookId,
  editor,
  onRename,
  error,
  dirty,
  aiChecking,
  openMark,
  noteHost,
  busy,
  onAction,
  aiEnabled,
  aiBusyKey,
  aiAdvice,
  onExplain,
  onApplyRewrite,
}: ManuscriptProps) {
  return (
    <>
      <div className={styles.manuscriptScroll}>
        <div className={styles.manuscript}>
          <div className={styles.eyebrow}>Chapter {numberWord(chapterNumber)}</div>
          <Title
            number={chapterNumber}
            title={chapterTitle}
            onRename={onRename}
            className={styles.title}
          />
          <a
            className={styles.exportLink}
            href={`/api/export/${activeBookId}/chapter/${chapterNumber}`}
            data-testid="export-chapter"
          >
            Export chapter (Markdown)
          </a>
          <div className={styles.titleRule} />
          <div className={styles.editor}>
            <EditorContent editor={editor} />
          </div>
          <SaveState
            error={error}
            dirty={dirty}
            aiChecking={aiChecking}
          />
        </div>
      </div>

      {/* Portal the note into the plugin's widget host under the open paragraph. */}
      {openMark && noteHost
        ? createPortal(
            <Note
              mark={openMark}
              busy={busy}
              onAction={onAction}
              ai={{
                enabled: aiEnabled,
                busy: aiBusyKey === openMark.markKey,
                explanation: aiAdvice[openMark.markKey]?.explanation,
                rewrite: aiAdvice[openMark.markKey]?.rewrite,
                error: aiAdvice[openMark.markKey]?.error,
                onExplain: () => onExplain(openMark),
                onApplyRewrite: (rewrite) => onApplyRewrite(openMark, rewrite),
              }}
            />,
            noteHost,
          )
        : null}
    </>
  );
}
