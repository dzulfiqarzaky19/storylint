import { describe, it, expect } from 'vitest';
import { sentenceBounds } from '@/components/write/markDecorations';

// sentenceBounds is the pure core of resolveSentenceRange: given a paragraph's
// plain text and a run's [start,end) offsets, it returns the [start,end) of the
// enclosing sentence. These lock the bounds so the whole-sentence AI rewrite
// always splices a self-contained, grammatical unit.
describe('sentenceBounds', () => {
  const para =
    'She was born in spring. Maren was nineteen and sworn out of season. They left at dawn.';
  const runOf = (quote: string) => {
    const start = para.indexOf(quote);
    return { start, end: start + quote.length };
  };

  it('bounds the middle sentence, includes its terminator, trims leading space', () => {
    const { start, end } = runOf('nineteen and sworn');
    const { start: s, end: e } = sentenceBounds(para, start, end);
    expect(para.slice(s, e)).toBe('Maren was nineteen and sworn out of season.');
  });

  it('bounds the first sentence from offset 0', () => {
    const { start, end } = runOf('born in spring');
    const { start: s, end: e } = sentenceBounds(para, start, end);
    expect(s).toBe(0);
    expect(para.slice(s, e)).toBe('She was born in spring.');
  });

  it('bounds the final sentence with no trailing terminator', () => {
    const noDot = 'A. B. Third one runs to the very end';
    const q = 'very end';
    const start = noDot.indexOf(q);
    const { start: s, end: e } = sentenceBounds(noDot, start, start + q.length);
    expect(noDot.slice(s, e)).toBe('Third one runs to the very end');
    expect(e).toBe(noDot.length);
  });

  it('handles ! and ? terminators', () => {
    const mixed = 'Wait! Is that her? Yes indeed.';
    const q = 'that her';
    const start = mixed.indexOf(q);
    const { start: s, end: e } = sentenceBounds(mixed, start, start + q.length);
    expect(mixed.slice(s, e)).toBe('Is that her?');
  });

  it('clamps out-of-range offsets instead of throwing', () => {
    const { start: s, end: e } = sentenceBounds('One only.', -5, 999);
    expect(s).toBe(0);
    expect(e).toBe('One only.'.length);
  });
});
