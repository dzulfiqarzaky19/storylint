import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useEditor, type Editor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type { Mark } from '@/domain/check';
import type { WriteState } from '@/features/write/state/writeStore';
import {
  createMarkDecorationPlugin,
  type MarkDecorationData,
} from '../Manuscript/markDecorations';
import { redrawMarks } from '../lib/markEditing';

/**
 * The Tiptap editor plus the mark underlines drawn over it. The decoration
 * plugin is created once and reads marks through `stateRef`, so it always sees
 * the latest state without the editor being rebuilt.
 */
export function useManuscriptEditor(args: {
  initialBody: unknown;
  stateRef: RefObject<WriteState>;
  marks: Mark[];
  openMarkKey: string | null;
  onSelectMark: (markKey: string) => void;
}): { editor: Editor | null; noteHost: HTMLElement | null } {
  const { initialBody, stateRef, marks, openMarkKey, onSelectMark } = args;

  const [noteHost] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.setAttribute('data-write-note-host', '');
    return el;
  });

  const onSelectMarkRef = useRef(onSelectMark);
  useEffect(() => {
    onSelectMarkRef.current = onSelectMark;
  });

  const getPluginData = useCallback((): MarkDecorationData => {
    const s = stateRef.current;
    return {
      marks: s.marks,
      openMarkKey: s.openMarkKey,
      noteHost,
      onUnderlineClick: (markKey) => onSelectMarkRef.current(markKey),
    };
  }, [noteHost, stateRef]);

  const decorationExtension = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      Extension.create({
        name: 'writeMarkDecorations',
        addProseMirrorPlugins() {
          return [createMarkDecorationPlugin(getPluginData)];
        },
      }),
    [getPluginData],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      decorationExtension,
    ],
    content: initialBody as object,
  });

  useEffect(() => {
    if (editor) redrawMarks(editor);
  }, [editor, marks, openMarkKey]);

  return { editor, noteHost };
}
