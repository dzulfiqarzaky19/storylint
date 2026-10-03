'use client';

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState } from '@tiptap/pm/state';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { Mark } from '@/domain/check';

export interface MarkDecorationData {
  marks: Mark[];
  openMarkKey: string | null;
  noteHost: HTMLElement | null;
  onUnderlineClick: (markKey: string) => void;
}

export const markDecorationKey = new PluginKey<MarkDecorationData>(
  'write-mark-decorations',
);

// A mark's anchor is paragraph + occurrence + quote, never an absolute offset,
// so positions are recomputed against the live doc and survive a moved paragraph.
export function resolveMarkRange(
  doc: PmNode,
  mark: Mark,
): { from: number; to: number } | null {
  const { paragraphIndex, occurrenceIndex } = mark.position;

  let found: { from: number; to: number } | null = null;
  let blockIndex = -1;
  doc.forEach((node, offset) => {
    blockIndex += 1;
    if (blockIndex !== paragraphIndex || found) return;

    const text = node.textContent;
    let searchFrom = 0;
    let charIndex = -1;
    for (let i = 0; i <= occurrenceIndex; i += 1) {
      charIndex = text.indexOf(mark.quote, searchFrom);
      if (charIndex === -1) break;
      searchFrom = charIndex + mark.quote.length;
    }
    if (charIndex === -1) return;

    // +1 steps inside the paragraph's opening token.
    const from = offset + 1 + charIndex;
    const to = from + mark.quote.length;
    found = { from, to };
  });

  return found;
}

export function sentenceBounds(
  text: string,
  runStart: number,
  runEnd: number,
): { start: number; end: number } {
  const isEnd = (ch: string) => ch === '.' || ch === '!' || ch === '?';
  let s = Math.max(0, Math.min(runStart, text.length));
  while (s > 0 && !isEnd(text[s - 1]!)) s -= 1;
  while (s < runStart && text[s] === ' ') s += 1;
  let e = Math.max(0, Math.min(runEnd, text.length));
  while (e < text.length && !isEnd(text[e]!)) e += 1;
  if (e < text.length) e += 1;
  return { start: s, end: e };
}

export function resolveSentenceRange(
  doc: PmNode,
  mark: Mark,
): { from: number; to: number; text: string } | null {
  const run = resolveMarkRange(doc, mark);
  if (!run) return null;

  const { paragraphIndex } = mark.position;
  let result: { from: number; to: number; text: string } | null = null;
  let blockIndex = -1;
  doc.forEach((node, offset) => {
    blockIndex += 1;
    if (blockIndex !== paragraphIndex || result) return;

    const text = node.textContent;
    const paraStart = offset + 1;
    const runStart = run.from - paraStart;
    const runEnd = run.to - paraStart;
    if (runStart < 0 || runEnd > text.length) {
      result = { from: paraStart, to: paraStart + text.length, text };
      return;
    }

    const { start, end } = sentenceBounds(text, runStart, runEnd);
    result = {
      from: paraStart + start,
      to: paraStart + end,
      text: text.slice(start, end),
    };
  });

  return result;
}

function buildDecorations(
  state: EditorState,
  data: MarkDecorationData,
): DecorationSet {
  const decos: Decoration[] = [];

  for (const mark of data.marks) {
    const range = resolveMarkRange(state.doc, mark);
    if (!range) continue;

    const className =
      mark.kind === 'conflict'
        ? 'write-underline write-underline-conflict'
        : 'write-underline write-underline-unrecorded';

    decos.push(
      Decoration.inline(range.from, range.to, {
        class: className,
        'data-mark-key': mark.markKey,
      }),
    );

    if (mark.markKey === data.openMarkKey && data.noteHost) {
      const $to = state.doc.resolve(range.to);
      const paragraphEnd = $to.end($to.depth);
      const host = data.noteHost;
      decos.push(
        Decoration.widget(paragraphEnd, () => host, {
          side: 1,
          // Keyed by markKey so the widget re-places when the open mark changes.
          key: `note-${mark.markKey}`,
        }),
      );
    }
  }

  return DecorationSet.create(state.doc, decos);
}

export function createMarkDecorationPlugin(
  getData: () => MarkDecorationData,
): Plugin<MarkDecorationData> {
  return new Plugin<MarkDecorationData>({
    key: markDecorationKey,
    state: {
      init: () => getData(),
      apply: (_tr, _value) => getData(),
    },
    props: {
      decorations(state) {
        return buildDecorations(state, getData());
      },
      handleClick(view, _pos, event) {
        const target = (event.target as HTMLElement)?.closest?.(
          '[data-mark-key]',
        ) as HTMLElement | null;
        if (!target) return false;
        const key = target.getAttribute('data-mark-key');
        if (!key) return false;
        getData().onUnderlineClick(key);
        return true;
      },
    },
  });
}
