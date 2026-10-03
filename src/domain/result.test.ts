import { describe, expect, it } from 'vitest';

import {
  confirmWikiWrite,
  errorMessage,
  fail,
  requireWorldId,
  runAction,
  runActionBare,
} from './result';

describe('confirmWikiWrite', () => {
  it('issues a confirmation for an explicit yes', () => {
    expect(confirmWikiWrite({ confirmed: true })).toBeDefined();
  });

  it('refuses anything but an explicit yes, at compile time and at run time', () => {
    // @ts-expect-error a wiki write cannot be confirmed with false
    expect(() => confirmWikiWrite({ confirmed: false })).toThrow(/explicit confirmation required/);
  });
});

describe('errorMessage', () => {
  it.each([
    ['an Error', new Error('boom'), 'boom'],
    ['a string', 'boom', 'boom'],
    ['a number', 42, '42'],
    ['null', null, 'null'],
  ])('reads the message from %s', (_name, thrown, expected) => {
    expect(errorMessage(thrown)).toBe(expected);
  });
});

describe('fail', () => {
  it('builds a failed result that says where it failed', () => {
    expect(fail(new Error('boom'), 'saveChapter')).toEqual({ ok: false, error: 'saveChapter: boom' });
  });
});

describe('runAction', () => {
  it('returns the result of the action', async () => {
    const result = await runAction('saveChapter', async () => ({ ok: true, data: 7 }));

    expect(result).toEqual({ ok: true, data: 7 });
  });

  it('passes a failed result through unchanged', async () => {
    const result = await runAction('saveChapter', async () => ({ ok: false, error: 'Not found' }));

    expect(result).toEqual({ ok: false, error: 'Not found' });
  });

  it('turns a thrown error into a failed result that names the action', async () => {
    const result = await runAction('saveChapter', async () => {
      throw new Error('connection lost');
    });

    expect(result).toEqual({ ok: false, error: 'saveChapter: connection lost' });
  });
});

describe('runActionBare', () => {
  it('turns a thrown error into a failed result with the bare message', async () => {
    const result = await runActionBare(async () => {
      throw new Error('connection lost');
    });

    expect(result).toEqual({ ok: false, error: 'connection lost' });
  });

  it('returns the result of the action', async () => {
    expect(await runActionBare(async () => ({ ok: true, data: 'x' }))).toEqual({ ok: true, data: 'x' });
  });
});

describe('requireWorldId', () => {
  it('returns the world id, trimmed', () => {
    expect(requireWorldId('  w1 ', 'createEntry')).toEqual({ ok: true, worldId: 'w1' });
  });

  it.each([[undefined], [''], ['   ']])('fails for %j', (worldId) => {
    expect(requireWorldId(worldId, 'createEntry')).toEqual({
      ok: false,
      error: 'createEntry: missing worldId - refusing to create a world-orphan entry',
    });
  });

  it('uses the given suffix in place of the default', () => {
    expect(requireWorldId(undefined, 'listThreads', '')).toEqual({
      ok: false,
      error: 'listThreads: missing worldId',
    });
  });
});
