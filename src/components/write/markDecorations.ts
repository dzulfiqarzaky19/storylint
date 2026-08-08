'use client';

/**
 * ProseMirror decoration plugin for the Write screen (HANDOFF §8).
 *
 * Turns the check engine's `Mark[]` into ProseMirror decorations over the live
 * document:
 *   - `Decoration.inline` on each mark's run, carrying ONE of two classes:
 *       `.write-underline-conflict`  → 3px solid  var(--accent)   (contradiction)
 *       `.write-underline-unrecorded`→ 3px dotted #7d7979         (unrecorded)
 *     The two are NEVER merged (product rule 2).
 *   - `Decoration.widget` at the END of the paragraph containing the OPEN mark
 *     (`side: 1`), an empty host <div> the editor React-portals the InlineNote
 *     into, so the note sits in document flow under its paragraph.
 *
 * Marks arrive with a stable `{ paragraphIndex, occurrenceIndex } + quote`
 * anchor (never an absolute offset), so this module recomputes absolute doc
 * positions on every doc/marks change — a mark survives its paragraph moving.
 *
 * Decoration / DecorationSet / Plugin come from Tiptap v3's ProseMirror
 * re-exports (`@tiptap/pm/*`), NOT a separately-installed prosemirror-*; this is
 * the documented way to reach ProseMirror primitives in Tiptap v3.
 * Source: node_modules/@tiptap/pm/view/index.ts (`export * from 'prosemirror-view'`),
 *         node_modules/@tiptap/pm/state/index.ts (`export * from 'prosemirror-state'`).
 */

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState } from '@tiptap/pm/state';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { Mark } from '@/lib/check';

export interface MarkDecorationData {
  marks: Mark[];
  openMarkKey: string | null;
  /** DOM host for the open note; the editor portals React into it. */
  noteHost: HTMLElement | null;
  /** Fired when an underline is clicked (same action as a rail-row click). */
  onUnderlineClick: (markKey: string) => void;
}

export const markDecorationKey = new PluginKey<MarkDecorationData>(
  'write-mark-decorations',
);

/** Absolute {from,to} of a mark's quote within its paragraph, or null. */
function resolveMarkRange(
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
    // Locate the occurrenceIndex-th occurrence of the quote in this paragraph.
    let searchFrom = 0;
    let charIndex = -1;
    for (let i = 0; i <= occurrenceIndex; i += 1) {
      charIndex = text.indexOf(mark.quote, searchFrom);
      if (charIndex === -1) break;
      searchFrom = charIndex + mark.quote.length;
    }
    if (charIndex === -1) return;

    // +1 to step inside the paragraph's opening token.
    const from = offset + 1 + charIndex;
    const to = from + mark.quote.length;
    found = { from, to };
  });

  return found;
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

    // Widget host for the open mark, at the end of its paragraph.
    if (mark.markKey === data.openMarkKey && data.noteHost) {
      const $to = state.doc.resolve(range.to);
      const paragraphEnd = $to.end($to.depth);
      const host = data.noteHost;
      decos.push(
        Decoration.widget(paragraphEnd, () => host, {
          side: 1,
          // Keying by markKey forces the widget to re-place when the open mark changes.
          key: `note-${mark.markKey}`,
        }),
      );
    }
  }

  return DecorationSet.create(state.doc, decos);
}

/**
 * Create the plugin. `getData` returns the current marks/open state/host each
 * time the plugin recomputes (the editor keeps this in a ref so React state
 * changes are picked up on the next transaction/dispatch).
 */
export function createMarkDecorationPlugin(
  getData: () => MarkDecorationData,
): Plugin<MarkDecorationData> {
  return new Plugin<MarkDecorationData>({
    key: markDecorationKey,
    state: {
      init: (_config, state) => {
        const data = getData();
        return data;
      },
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
