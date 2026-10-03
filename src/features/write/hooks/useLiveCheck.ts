import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { checkManuscript, type CheckWiki, type Mark } from '@/domain/check';
import { mergeMarks } from '@/domain/check/ai';
import {
  changedParagraphIndices,
  hashParagraphs,
  reconcileAiMarks,
} from '@/domain/check/paragraphCache';
import { docToParagraphs } from '@/domain/write/adapters';
import type { WriteAction, WriteState } from '@/features/write/state/writeStore';
import { saveManuscript } from '@/server/actions/write/manuscript';
import { aiCheckChapter, persistChapterCheck } from '@/server/actions/write/ai';
import { redrawMarks } from '../lib/markEditing';

const CHECK_DEBOUNCE_MS = 300;
const SAVE_DEBOUNCE_MS = 800;

/**
 * Everything that happens after a keystroke: the rule-based check (debounced),
 * the save (debounced), then the AI check of the paragraphs that changed.
 * AI marks are kept apart from the rule-based ones so each keystroke can
 * re-merge them without another AI round trip.
 */
export function useLiveCheck(args: {
  editor: Editor | null;
  stateRef: RefObject<WriteState>;
  dispatch: Dispatch<WriteAction>;
  wiki: CheckWiki;
  chapterCounts: [string, number][] | undefined;
  chapterNumber: number;
  universeId: string;
  bookId: string;
  aiEnabled: boolean;
  initialBody: unknown;
  initialAiMarks: Mark[];
}): { aiChecking: boolean } {
  const {
    editor,
    stateRef,
    dispatch,
    wiki,
    chapterCounts,
    chapterNumber,
    universeId,
    bookId,
    aiEnabled,
    initialBody,
    initialAiMarks,
  } = args;

  const chapterCountsMap = useMemo(() => new Map(chapterCounts ?? []), [chapterCounts]);

  const aiMarksRef = useRef<Mark[]>(initialAiMarks);
  const aiHashesRef = useRef<string[]>(
    initialAiMarks.length > 0 ? hashParagraphs(docToParagraphs(initialBody)) : [],
  );
  // A slow AI reply must not overwrite the result of a newer request.
  const aiCheckSeqRef = useRef(0);
  const [aiChecking, setAiChecking] = useState(false);

  const pushDeterministicMarks = useCallback(
    (body: unknown) => {
      const { marks } = checkManuscript({
        paragraphs: docToParagraphs(body),
        wiki,
        resolvedMarkKeys: stateRef.current.resolvedMarkKeys,
        chapterCounts: chapterCountsMap,
      });
      dispatch({ type: 'SET_MARKS', marks: mergeMarks(marks, aiMarksRef.current) });
    },
    [wiki, chapterCountsMap, stateRef, dispatch],
  );

  const runAiCheck = useCallback(
    async (body: unknown) => {
      if (!aiEnabled) return;
      const paragraphs = docToParagraphs(body);
      const changed = changedParagraphIndices(paragraphs, aiHashesRef.current);
      if (changed.length === 0) return;

      const seq = ++aiCheckSeqRef.current;
      setAiChecking(true);
      try {
        const res = await aiCheckChapter({
          universeId,
          paragraphs,
          changedIndices: changed,
          resolvedMarkKeys: stateRef.current.resolvedMarkKeys,
        });
        if (seq !== aiCheckSeqRef.current) return;
        if (!res.ok) {
          dispatch({ type: 'SET_ERROR', error: res.error });
          return;
        }
        aiMarksRef.current = reconcileAiMarks(
          aiMarksRef.current,
          res.data.marks,
          changed,
          paragraphs.length,
        );
        aiHashesRef.current = hashParagraphs(paragraphs);
        pushDeterministicMarks(body);
        if (editor) redrawMarks(editor);
        void persistChapterCheck({
          chapterNumber,
          universeId,
          bookId,
          body,
          marks: aiMarksRef.current,
        });
      } finally {
        if (seq === aiCheckSeqRef.current) setAiChecking(false);
      }
    },
    [aiEnabled, editor, pushDeterministicMarks, chapterNumber, universeId, bookId, stateRef, dispatch],
  );

  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editor) return;

    const onUpdate = () => {
      const body = editor.getJSON();
      dispatch({ type: 'EDIT_BODY', body });

      if (checkTimer.current) clearTimeout(checkTimer.current);
      checkTimer.current = setTimeout(() => {
        pushDeterministicMarks(body);
        redrawMarks(editor);
      }, CHECK_DEBOUNCE_MS);

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        dispatch({ type: 'SAVE_MANUSCRIPT' });
        const res = await saveManuscript({ bookId, chapterNumber, body });
        if (res.ok) {
          dispatch({ type: 'SAVE_SUCCEEDED' });
          void runAiCheck(body);
        } else {
          dispatch({ type: 'SET_ERROR', error: res.error });
        }
      }, SAVE_DEBOUNCE_MS);
    };

    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
      if (checkTimer.current) clearTimeout(checkTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [editor, chapterNumber, bookId, pushDeterministicMarks, runAiCheck, dispatch]);

  const didMountCheckRef = useRef(false);
  useEffect(() => {
    if (!editor || didMountCheckRef.current) return;
    didMountCheckRef.current = true;
    const body = editor.getJSON();
    pushDeterministicMarks(body);
    redrawMarks(editor);
    void runAiCheck(body);
  }, [editor, pushDeterministicMarks, runAiCheck]);

  return { aiChecking };
}
