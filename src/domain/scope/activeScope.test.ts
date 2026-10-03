import { describe, expect, it } from 'vitest';

import type { WorldUniverseNode } from '@/domain/structure';
import { resolveActiveScope, scopedHref } from './activeScope';

const TREE: WorldUniverseNode[] = [
  {
    id: 'u1',
    name: 'First',
    worlds: [
      { id: 'w1', title: 'World one', sortOrder: 0, books: [{ id: 'b1', name: 'Book one', sortOrder: 0 }] },
      {
        id: 'w2',
        title: 'World two',
        sortOrder: 1,
        books: [
          { id: 'b2', name: 'Book two', sortOrder: 0 },
          { id: 'b3', name: 'Book three', sortOrder: 1 },
        ],
      },
    ],
  },
  {
    id: 'u2',
    name: 'Second',
    worlds: [{ id: 'w9', title: 'World nine', sortOrder: 0, books: [] }],
  },
];

describe('resolveActiveScope', () => {
  it('uses the universe, world and book named in the URL', () => {
    expect(resolveActiveScope(TREE, { u: 'u1', w: 'w2', book: 'b3' })).toEqual({
      universeId: 'u1',
      worldId: 'w2',
      bookId: 'b3',
    });
  });

  it('lands on the first of everything when the URL names nothing', () => {
    expect(resolveActiveScope(TREE, {})).toEqual({ universeId: 'u1', worldId: 'w1', bookId: 'b1' });
  });

  it('falls back to the first book of the chosen world for a stale book id', () => {
    expect(resolveActiveScope(TREE, { u: 'u1', w: 'w2', book: 'gone' }).bookId).toBe('b2');
  });

  it('falls back to the chosen universe’s first world when the world belongs elsewhere', () => {
    expect(resolveActiveScope(TREE, { u: 'u2', w: 'w2' })).toEqual({
      universeId: 'u2',
      worldId: 'w9',
      bookId: '',
    });
  });

  it('falls back to the first universe for a stale universe id', () => {
    expect(resolveActiveScope(TREE, { u: 'gone' }).universeId).toBe('u1');
  });

  it('returns empty ids when there is nothing in the database', () => {
    expect(resolveActiveScope([], { u: 'u1' })).toEqual({ universeId: '', worldId: '', bookId: '' });
  });
});

describe('scopedHref', () => {
  const SCOPE = { universeId: 'u1', worldId: 'w2', bookId: 'b3' };

  it('carries universe, world and book on the write surface', () => {
    expect(scopedHref('/write', SCOPE)).toBe('/write?u=u1&w=w2&book=b3');
  });

  it.each([['/wiki'], ['/research'], ['/plot'], ['/somewhere-else']])(
    'carries universe and world, but not the book, on %s',
    (path) => {
      expect(scopedHref(path, SCOPE)).toBe(`${path}?u=u1&w=w2`);
    },
  );

  it('matches a surface by prefix, so nested paths keep the same scope', () => {
    expect(scopedHref('/write/chapter', SCOPE)).toBe('/write/chapter?u=u1&w=w2&book=b3');
  });

  it('leaves out an axis that has no value', () => {
    expect(scopedHref('/write', { universeId: 'u1', worldId: '' })).toBe('/write?u=u1');
  });

  it('returns the bare path when there is nothing to carry', () => {
    expect(scopedHref('/wiki', {})).toBe('/wiki');
  });

  it('appends extra parameters, URL-encoded', () => {
    expect(scopedHref('/wiki', { universeId: 'u1' }, { entry: 'a b' })).toBe('/wiki?u=u1&entry=a+b');
  });
});
