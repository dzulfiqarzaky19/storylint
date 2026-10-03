import { describe, expect, it } from 'vitest';

import { changedParagraphIndices, hashParagraphs, reconcileAiMarks } from './paragraphCache';
import { mark } from './testing/wiki';

function markAt(paragraphIndex: number, markKey = `p${paragraphIndex}`) {
  return mark({ markKey, position: { paragraphIndex, occurrenceIndex: 0 } });
}

describe('hashParagraphs', () => {
  it('returns one hash per paragraph, in order', () => {
    const [a, b] = hashParagraphs(['One.', 'Two.']);

    expect([a, b]).toEqual(hashParagraphs(['One.', 'Two.']));
    expect(a).not.toBe(b);
  });

  it('ignores whitespace-only differences', () => {
    expect(hashParagraphs(['One  two. '])).toEqual(hashParagraphs(['One two.']));
  });
});

describe('changedParagraphIndices', () => {
  const BEFORE = ['One.', 'Two.', 'Three.'];

  it('treats every paragraph as changed on the first pass', () => {
    expect(changedParagraphIndices(BEFORE, [])).toEqual([0, 1, 2]);
  });

  it('reports nothing when no paragraph changed', () => {
    expect(changedParagraphIndices(BEFORE, hashParagraphs(BEFORE))).toEqual([]);
  });

  it('reports only the edited paragraph', () => {
    const after = ['One.', 'Two, edited.', 'Three.'];

    expect(changedParagraphIndices(after, hashParagraphs(BEFORE))).toEqual([1]);
  });

  it('reports an appended paragraph', () => {
    expect(changedParagraphIndices([...BEFORE, 'Four.'], hashParagraphs(BEFORE))).toEqual([3]);
  });

  it('does not report a paragraph whose only change is whitespace', () => {
    expect(changedParagraphIndices(['One. ', 'Two.', 'Three.'], hashParagraphs(BEFORE))).toEqual([]);
  });
});

describe('reconcileAiMarks', () => {
  const PREVIOUS = [markAt(0), markAt(1), markAt(2)];

  it('keeps marks on untouched paragraphs and replaces those on re-checked ones', () => {
    const fresh = [markAt(1, 'fresh')];

    const result = reconcileAiMarks(PREVIOUS, fresh, [1], 3);

    expect(result.map((m) => m.markKey)).toEqual(['p0', 'p2', 'fresh']);
  });

  it('drops marks on a re-checked paragraph even when the re-check found nothing', () => {
    expect(reconcileAiMarks(PREVIOUS, [], [1], 3).map((m) => m.markKey)).toEqual(['p0', 'p2']);
  });

  it('drops marks that point past the end of a shortened chapter', () => {
    expect(reconcileAiMarks(PREVIOUS, [], [], 2).map((m) => m.markKey)).toEqual(['p0', 'p1']);
  });

  it('keeps the earlier mark when a fresh one has the same key', () => {
    const kept = markAt(0, 'same');
    const fresh = mark({ markKey: 'same', rail: 'fresh', position: { paragraphIndex: 1, occurrenceIndex: 0 } });

    expect(reconcileAiMarks([kept], [fresh], [1], 2)).toEqual([kept]);
  });
});
