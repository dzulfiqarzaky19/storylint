import { describe, expect, it } from 'vitest';

import { shouldShowChapterDot, type ChapterSeverity } from './severity';

describe('shouldShowChapterDot', () => {
  it.each<[string, ChapterSeverity | undefined, number, number, boolean]>([
    ['shows a red dot on a chapter that is not open', 'red', 2, 1, true],
    ['shows a yellow dot on a chapter that is not open', 'yellow', 2, 1, true],
    ['hides the dot on the open chapter', 'red', 1, 1, false],
    ['hides the dot on a clean chapter', null, 2, 1, false],
    ['hides the dot when the severity is not loaded', undefined, 2, 1, false],
  ])('%s', (_name, severity, chapterNumber, selectedNumber, expected) => {
    expect(shouldShowChapterDot(severity, chapterNumber, selectedNumber)).toBe(expected);
  });
});
