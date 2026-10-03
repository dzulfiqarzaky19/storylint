import { describe, expect, it } from 'vitest';

import { hashValue, sha1, stableStringify } from './hash';

describe('sha1', () => {
  it('matches the published SHA-1 test vector for "abc"', () => {
    expect(sha1('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });
});

describe('stableStringify', () => {
  it('writes object keys in sorted order whatever order they were set in', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('sorts keys at every depth', () => {
    expect(stableStringify({ z: { b: 1, a: 2 }, a: [{ d: 1, c: 2 }] })).toBe(
      '{"a":[{"c":2,"d":1}],"z":{"a":2,"b":1}}',
    );
  });

  it('keeps array order', () => {
    expect(stableStringify([2, 1])).toBe('[2,1]');
  });

  it.each([
    ['null', null, 'null'],
    ['undefined', undefined, 'null'],
    ['a string', 'a"b', '"a\\"b"'],
    ['a number', 1.5, '1.5'],
    ['a boolean', false, 'false'],
  ])('serialises %s', (_name, value, expected) => {
    expect(stableStringify(value)).toBe(expected);
  });
});

describe('hashValue', () => {
  it('is the same for two objects that differ only in key order', () => {
    expect(hashValue({ body: 'x', n: 1 })).toBe(hashValue({ n: 1, body: 'x' }));
  });

  it('differs when a value differs', () => {
    expect(hashValue({ body: 'x' })).not.toBe(hashValue({ body: 'y' }));
  });

  it('differs when array order differs', () => {
    expect(hashValue(['a', 'b'])).not.toBe(hashValue(['b', 'a']));
  });
});
