import { describe, expect, it } from 'vitest';

import { mark } from '@/domain/check/testing/wiki';
import { resolutionIdOf, writeMarkTarget } from './markEditing';

describe('resolutionIdOf', () => {
  it.each([
    ['wiki', 'wiki'],
    ['text', 'text'],
    ['leave', 'leave'],
    ['add', 'wiki'],
    ['edit', 'text'],
  ])('maps the "%s" action to the "%s" resolution', (actionId, expected) => {
    expect(resolutionIdOf({ id: actionId, label: '' })).toBe(expected);
  });

  it('treats an action it does not know as "leave", which writes nothing', () => {
    expect(resolutionIdOf({ id: 'something-new', label: '' })).toBe('leave');
  });
});

describe('writeMarkTarget', () => {
  it('uses the target the check already resolved', () => {
    const resolvedTarget = { category: {}, entry: { id: 'maren' }, fact: { key: 'Eyes', value: 'Green' } };

    expect(writeMarkTarget(mark({ resolvedTarget }))).toBe(resolvedTarget);
  });

  it('proposes a new entry named after the quote when the check resolved no target', () => {
    const unresolved = mark({ quote: 'the tallow rule', noteText: 'Nothing records it.' });

    expect(writeMarkTarget(unresolved)).toEqual({
      category: {},
      entry: { proposeName: 'the tallow rule' },
      fact: { key: 'the tallow rule', value: 'Nothing records it.' },
    });
  });
});
