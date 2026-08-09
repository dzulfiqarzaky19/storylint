/**
 * Characterization (behavior-lock) for createMarkDecorationPlugin's state.init.
 *
 * init is a pure passthrough: it must return exactly what the injected getData()
 * returns, once. This test locks that contract BEFORE the init callback is
 * simplified from `(_config, state) => { const data = getData(); return data; }`
 * to `() => getData()`, so the refactor is provably behavior-neutral.
 *
 * We reach the callback through the ProseMirror Plugin spec
 * (plugin.spec.state.init), the documented shape prosemirror-state stores the
 * StateField config under. init ignores both of its args (config, editorState),
 * so passing undefined stubs exercises the real return path without a live
 * editor.
 */

import { describe, it, expect } from 'vitest';
import { createMarkDecorationPlugin } from '@/components/write/markDecorations';
import type { MarkDecorationData } from '@/components/write/markDecorations';
import type { EditorState } from '@tiptap/pm/state';

function stubData(): MarkDecorationData {
  return {
    marks: [],
    openMarkKey: null,
    noteHost: null,
    onUnderlineClick: () => {},
  };
}

describe('createMarkDecorationPlugin — state.init', () => {
  it('returns exactly the object getData() returns', () => {
    const payload = stubData();
    let calls = 0;
    const plugin = createMarkDecorationPlugin(() => {
      calls += 1;
      return payload;
    });

    const init = plugin.spec.state!.init;
    // init ignores (config, editorState); pass minimal stubs.
    const result = init.call(
      plugin.spec.state,
      {} as never,
      undefined as unknown as EditorState,
    );

    // Same reference getData() returned, produced by exactly one call.
    expect(result).toBe(payload);
    expect(calls).toBe(1);
  });
});
