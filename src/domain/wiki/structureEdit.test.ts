import { describe, expect, it } from 'vitest';

import { LAST_CHILD_BLOCK, lastChildHint } from './structureEdit';

describe('lastChildHint', () => {
  it.each([
    ['world', 1],
    ['book', 1],
    ['book', 0],
  ] as const)('blocks deleting the last %s (siblings: %i)', (level, siblingCount) => {
    expect(lastChildHint(level, siblingCount)).toBe(LAST_CHILD_BLOCK[level]);
  });

  it.each([
    ['world', 2],
    ['book', 5],
  ] as const)('allows deleting a %s that has siblings (%i)', (level, siblingCount) => {
    expect(lastChildHint(level, siblingCount)).toBeNull();
  });

  it('never blocks deleting a universe, even the last one', () => {
    expect(lastChildHint('universe', 1)).toBeNull();
  });
});
