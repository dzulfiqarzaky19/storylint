import { describe, expect, it } from 'vitest';

import { decideStreamEnd, STREAM_INCOMPLETE_MESSAGE } from './decideStreamEnd';

describe('decideStreamEnd', () => {
  it('reports an unfinished answer and gives the writer their question back', () => {
    const decision = decideStreamEnd({ reconciled: false, sawError: false, question: 'Who keeps the light?' });

    expect(decision).toEqual({ setError: STREAM_INCOMPLETE_MESSAGE, restoreDraft: 'Who keeps the light?' });
  });

  it.each([
    ['the answer was saved', { reconciled: true, sawError: false }],
    ['the stream already reported its own error', { reconciled: false, sawError: true }],
  ])('does nothing when %s', (_name, flags) => {
    expect(decideStreamEnd({ ...flags, question: 'Who keeps the light?' })).toEqual({});
  });
});
