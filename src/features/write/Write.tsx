'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { Mark, CheckWiki } from '@/domain/check';
import { mergeMarks } from '@/domain/check/ai';
import {
  writeReducer,
  initWriteState,
  type WriteState,
} from '@/features/write/state/writeStore';
import WikiTargetPicker from '@/components/WikiTargetPicker';
import { useManuscriptEditor } from './hooks/useManuscriptEditor';
import { useLiveCheck } from './hooks/useLiveCheck';
import { useMarkActions } from './hooks/useMarkActions';
import { useChapterNav } from './hooks/useChapterNav';
import { writeMarkTarget } from './lib/markEditing';
import Manuscript from './Manuscript/Manuscript';
import Outstanding from './Outstanding';
import Chapters, { type ChaptersChapter } from './Chapters';
import ChapterDelete from './ChapterDelete';
import styles from './Write.module.css';

export interface WriteProps {
  chapterNumber: number;
  chapterTitle: string;
  initialBody: unknown;
  initialMarks: Mark[];
  wiki: CheckWiki;
  resolvedMarkKeys: string[];
  chapterCounts?: [string, number][];
  chapters: ChaptersChapter[];
  activeBookId: string;
  activeUniverseId: string;
  initialAiMarks?: Mark[];
  aiEnabled?: boolean;
  activeWorldId: string;
  pickerEntries: { id: string; name: string; kind: string }[];
  pickerCategories: { id: string; label: string }[];
}

const NO_MARKS: Mark[] = [];

export default function Write({
  chapterNumber,
  chapterTitle,
  initialBody,
  initialMarks,
  wiki,
  resolvedMarkKeys,
  chapters,
  chapterCounts,
  activeBookId,
  activeUniverseId,
  initialAiMarks = NO_MARKS,
  aiEnabled = false,
  activeWorldId,
  pickerEntries,
  pickerCategories,
}: WriteProps) {
  const [state, dispatch] = useReducer(
    writeReducer,
    {
      chapterNumber,
      body: initialBody,
      marks: initialAiMarks.length > 0 ? mergeMarks(initialMarks, initialAiMarks) : initialMarks,
      resolvedMarkKeys,
    },
    initWriteState,
  );

  // Handlers and the editor plugin read the latest state through this ref, so
  // they keep a stable identity across renders.
  const stateRef = useRef<WriteState>(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const selectMark = useCallback((markKey: string) => {
    dispatch({ type: 'OPEN_MARK', markKey });
  }, []);
  const reportError = useCallback((error: string) => {
    dispatch({ type: 'SET_ERROR', error });
  }, []);

  const { editor, noteHost } = useManuscriptEditor({
    initialBody,
    stateRef,
    marks: state.marks,
    openMarkKey: state.openMarkKey,
    onSelectMark: selectMark,
  });

  const { aiChecking } = useLiveCheck({
    editor,
    stateRef,
    dispatch,
    wiki,
    chapterCounts,
    chapterNumber,
    universeId: activeUniverseId,
    bookId: activeBookId,
    aiEnabled,
    initialBody,
    initialAiMarks,
  });

  const marks = useMarkActions({
    editor,
    stateRef,
    dispatch,
    aiEnabled,
    universeId: activeUniverseId,
    worldId: activeWorldId,
    bookId: activeBookId,
  });

  const scope = useMemo(
    () => ({ universeId: activeUniverseId, worldId: activeWorldId, bookId: activeBookId }),
    [activeUniverseId, activeWorldId, activeBookId],
  );
  const nav = useChapterNav({ chapterNumber, scope, onError: reportError });

  const openMark = useMemo(
    () => state.marks.find((m) => m.markKey === state.openMarkKey) ?? null,
    [state.marks, state.openMarkKey],
  );

  return (
    <div className={styles.screen}>
      <div className={styles.body}>
        <Chapters
          chapters={chapters}
          selectedNumber={chapterNumber}
          onSelect={nav.select}
          onCreate={nav.add}
          onRename={nav.rename}
          onRequestDelete={nav.requestDelete}
        />
        <Manuscript
          chapterNumber={chapterNumber}
          chapterTitle={chapterTitle}
          activeBookId={activeBookId}
          editor={editor}
          onRename={nav.rename}
          error={state.error}
          dirty={state.dirty}
          aiChecking={aiChecking}
          openMark={openMark}
          noteHost={noteHost}
          busy={marks.busy}
          onAction={marks.act}
          aiEnabled={aiEnabled}
          aiBusyKey={marks.aiBusyKey}
          aiAdvice={marks.aiAdvice}
          onExplain={marks.explain}
          onApplyRewrite={marks.applyRewrite}
        />

        <Outstanding
          marks={state.marks}
          openMarkKey={state.openMarkKey}
          onSelect={selectMark}
        />
      </div>

      {marks.pendingPickerMark ? (
        <WikiTargetPicker
          resolvedTarget={writeMarkTarget(marks.pendingPickerMark)}
          checkedAgainst={marks.pendingPickerMark.checkedAgainst}
          categories={pickerCategories}
          entries={pickerEntries}
          onConfirm={marks.confirmPicker}
          onCancel={marks.cancelPicker}
        />
      ) : null}

      {nav.pendingDeleteNumber !== null ? (
        <ChapterDelete
          number={nav.pendingDeleteNumber}
          title={chapters.find((c) => c.number === nav.pendingDeleteNumber)?.title ?? ''}
          busy={nav.deleteBusy}
          onConfirm={nav.confirmDelete}
          onCancel={nav.cancelDelete}
        />
      ) : null}
    </div>
  );
}
