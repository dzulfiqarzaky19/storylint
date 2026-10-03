import { describe, expect, it } from 'vitest';

import { trashCountdown } from './trashCountdown';

const DAY_MS = 24 * 60 * 60 * 1000;
const DELETED_AT = 1_000_000;

describe('trashCountdown', () => {
  it.each([
    ['just deleted', 0, { purgeable: false, daysLeft: 7 }],
    ['one day later', DAY_MS, { purgeable: false, daysLeft: 6 }],
    ['half a day before the deadline, rounded up to a whole day', 6.5 * DAY_MS, { purgeable: false, daysLeft: 1 }],
    ['at the deadline', 7 * DAY_MS, { purgeable: true, daysLeft: 0 }],
    ['long past the deadline, never negative', 30 * DAY_MS, { purgeable: true, daysLeft: 0 }],
  ])('%s', (_name, elapsed, expected) => {
    expect(trashCountdown(DELETED_AT, DELETED_AT + elapsed)).toEqual(expected);
  });
});
