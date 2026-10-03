import { useCallback, useState, type Dispatch, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import type { Mark, MarkAction } from '@/domain/check';
import type { PickerResult } from '@/domain/wiki/pickedTarget';
import { docToParagraphs } from '@/domain/write/adapters';
import type { WriteAction, WriteState } from '@/features/write/state/writeStore';
import { explainMark } from '@/server/actions/write/ai';
import { resolveMark } from '@/server/actions/write/marks';
import { writeConfirmedTarget } from '@/server/actions/wiki/writeConfirmedTarget';
import { resolveMarkRange, resolveSentenceRange } from '../Manuscript/markDecorations';
import { resolutionIdOf, selectRunInEditor } from '../lib/markEditing';

export interface MarkAdvice {
  explanation: string;
  rewrite: string;
  error?: string;
}

/**
 * What the writer can do with an open mark: leave it, fix the text (optionally
 * with an AI rewrite), or send it to the wiki through the target picker.
 */
export function useMarkActions(args: {
  editor: Editor | null;
  stateRef: RefObject<WriteState>;
  dispatch: Dispatch<WriteAction>;
  aiEnabled: boolean;
  universeId: string;
  worldId: string;
  bookId: string;
}) {
  const { editor, stateRef, dispatch, aiEnabled, universeId, worldId, bookId } = args;

  const [busy, setBusy] = useState(false);
  const [pendingPickerMark, setPendingPickerMark] = useState<Mark | null>(null);
  const [aiBusyKey, setAiBusyKey] = useState<string | null>(null);
  const [aiAdvice, setAiAdvice] = useState<Record<string, MarkAdvice>>({});

  const explain = useCallback(
    async (mark: Mark) => {
      setAiBusyKey(mark.markKey);
      try {
        const paragraphs = docToParagraphs(stateRef.current.body);
        const res = await explainMark({
          universeId,
          quote: mark.quote,
          kind: mark.kind,
          noteText: mark.noteText,
          paragraph: paragraphs[mark.position.paragraphIndex] ?? '',
          sentence: editor ? resolveSentenceRange(editor.state.doc, mark)?.text : undefined,
          entityId: mark.entityId,
        });
        setAiAdvice((prev) => ({
          ...prev,
          [mark.markKey]: res.ok
            ? { explanation: res.data.explanation, rewrite: res.data.rewrite }
            : { explanation: '', rewrite: '', error: res.error },
        }));
      } finally {
        setAiBusyKey(null);
      }
    },
    [editor, universeId, stateRef],
  );

  const act = useCallback(
    async (mark: Mark, action: MarkAction) => {
      const resolution = resolutionIdOf(action);
      if (resolution === 'wiki') {
        setPendingPickerMark(mark);
        dispatch({ type: 'OPEN_MARK', markKey: null });
        return;
      }
      setBusy(true);
      try {
        if (resolution === 'text') {
          selectRunInEditor(editor, mark);
          if (aiEnabled && !aiAdvice[mark.markKey]) void explain(mark);
          return;
        }

        const res = await resolveMark(mark.markKey, 'leave', { bookId, quote: mark.quote });
        if (!res.ok) {
          dispatch({ type: 'SET_ERROR', error: res.error });
          return;
        }
        dispatch({ type: 'RESOLVE_MARK', markKey: mark.markKey, actionId: 'leave' });
      } finally {
        setBusy(false);
      }
    },
    [editor, aiEnabled, aiAdvice, explain, bookId, dispatch],
  );

  const cancelPicker = useCallback(() => {
    const mark = pendingPickerMark;
    setPendingPickerMark(null);
    if (mark) dispatch({ type: 'OPEN_MARK', markKey: mark.markKey });
  }, [pendingPickerMark, dispatch]);

  const confirmPicker = useCallback(
    async (result: PickerResult) => {
      const mark = pendingPickerMark;
      if (!mark) return;
      setPendingPickerMark(null);
      setBusy(true);
      try {
        const res = await writeConfirmedTarget({
          result,
          origin: { from: 'mark', mark },
          worldId,
          confirmed: true,
        });
        if (!res.ok) {
          dispatch({ type: 'SET_ERROR', error: res.error });
          return;
        }
        dispatch({ type: 'RESOLVE_MARK', markKey: mark.markKey, actionId: 'leave' });
      } finally {
        setBusy(false);
      }
    },
    [pendingPickerMark, worldId, dispatch],
  );

  const applyRewrite = useCallback(
    (mark: Mark, rewrite: string) => {
      if (!editor || !rewrite) return;
      const range =
        resolveSentenceRange(editor.state.doc, mark) ?? resolveMarkRange(editor.state.doc, mark);
      if (!range) return;
      editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, rewrite).run();
      dispatch({ type: 'OPEN_MARK', markKey: null });
    },
    [editor, dispatch],
  );

  return {
    busy,
    pendingPickerMark,
    aiBusyKey,
    aiAdvice,
    explain,
    act,
    applyRewrite,
    confirmPicker,
    cancelPicker,
  };
}
