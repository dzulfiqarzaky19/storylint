import { describe, expect, it } from 'vitest';

import { canSubmitName } from './nameGate';

describe('canSubmitName', () => {
  it.each([
    ['a name', 'Verge', true],
    ['a name padded with spaces', '  Verge ', true],
    ['an empty string', '', false],
    ['only whitespace', ' \t\n', false],
  ])('%s: %s', (_name, value, expected) => {
    expect(canSubmitName(value)).toBe(expected);
  });
});
