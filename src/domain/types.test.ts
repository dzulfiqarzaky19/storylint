import { describe, expect, it } from 'vitest';

import { KIND_FOR_SHELF, KIND_SHELF, kindLabelOf, type Kind } from './types';

describe('kindLabelOf', () => {
  it.each([
    ['character', 'Person'],
    ['world', 'Place'],
    ['organization', 'Order'],
    ['lore', 'Lore'],
  ])('labels the built-in kind %s as %s', (kind, label) => {
    expect(kindLabelOf(kind)).toBe(label);
  });

  it('shows a custom kind under its own id', () => {
    expect(kindLabelOf('ships')).toBe('ships');
  });
});

describe('the kind and shelf tables', () => {
  it.each(Object.keys(KIND_SHELF) as Kind[])('map %s to a shelf and back to itself', (kind) => {
    expect(KIND_FOR_SHELF[KIND_SHELF[kind]]).toBe(kind);
  });
});
