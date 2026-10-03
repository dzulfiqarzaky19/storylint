import type { Editor } from '@tiptap/react';
import type { Mark, MarkAction, ResolvedTarget } from '@/domain/check';
import { resolveMarkRange } from '../Manuscript/markDecorations';

export function resolutionIdOf(action: MarkAction): 'wiki' | 'text' | 'leave' {
  switch (action.id) {
    case 'wiki':
    case 'text':
    case 'leave':
      return action.id;
    case 'add':
      return 'wiki';
    case 'edit':
      return 'text';
    default:
      return 'leave';
  }
}

export function writeMarkTarget(mark: Mark): ResolvedTarget {
  return (
    mark.resolvedTarget ?? {
      category: {},
      entry: { proposeName: mark.quote },
      fact: { key: mark.quote, value: mark.noteText },
    }
  );
}

export function selectRunInEditor(editor: Editor | null, mark: Mark): void {
  if (!editor) return;
  const range = resolveMarkRange(editor.state.doc, mark);
  if (!range) return;

  editor
    .chain()
    .focus()
    .setTextSelection({ from: range.from, to: range.to })
    .scrollIntoView()
    .run();
}

/** The decoration plugin only recomputes on a transaction; this sends an empty one. */
export function redrawMarks(editor: Editor): void {
  editor.view.dispatch(editor.state.tr.setMeta('write-marks', true));
}
