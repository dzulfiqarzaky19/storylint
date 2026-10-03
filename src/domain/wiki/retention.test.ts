import { describe, expect, it } from 'vitest';

import { isPurgeable, RETENTION_MS } from './retention';

const DELETED_AT = 1_000_000;

describe('isPurgeable', () => {
  it('keeps an entry that was never deleted', () => {
    expect(isPurgeable(null, DELETED_AT + RETENTION_MS * 10)).toBe(false);
  });

  it.each([
    ['just deleted', 0, false],
    ['one millisecond before the retention window ends', RETENTION_MS - 1, false],
    ['exactly at the end of the retention window', RETENTION_MS, true],
    ['long after the retention window', RETENTION_MS * 2, true],
  ])('%s: purgeable = %s', (_name, elapsed, expected) => {
    expect(isPurgeable(DELETED_AT, DELETED_AT + elapsed)).toBe(expected);
  });

  it('honours a custom retention window', () => {
    expect(isPurgeable(DELETED_AT, DELETED_AT + 500, 500)).toBe(true);
    expect(isPurgeable(DELETED_AT, DELETED_AT + 499, 500)).toBe(false);
  });

  it('retains deleted entries for seven days by default', () => {
    expect(RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
