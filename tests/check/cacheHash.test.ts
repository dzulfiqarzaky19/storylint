import { describe, it, expect } from 'vitest';
import { stableStringify, hashValue, sha1 } from '@/lib/check/hash';

// T-AICACHE: the AI-check cache is invalidated by comparing hashValue(body) and
// hashValue(wiki) against the stamped hashes. These tests lock the two properties
// that make that comparison correct:
//   1. STABILITY — structurally-equal values hash identically regardless of key
//      insertion order (the DB/driver may return object keys in any order), so a
//      fresh cache is NOT spuriously invalidated.
//   2. SENSITIVITY — any real change to the content or the wiki changes the hash,
//      so a stale cache IS invalidated and the AI re-runs.
describe('stableStringify (T-AICACHE cache invalidation)', () => {
  it('is INSENSITIVE to object key order (same value -> same string)', () => {
    const a = { name: 'Maren', kind: 'character', facts: [{ key: 'eyes', value: 'grey' }] };
    const b = { facts: [{ key: 'eyes', value: 'grey' }], kind: 'character', name: 'Maren' };
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(hashValue(a)).toBe(hashValue(b));
  });

  it('sorts keys at EVERY depth, not just the top level', () => {
    const a = { outer: { z: 1, a: 2 } };
    const b = { outer: { a: 2, z: 1 } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('preserves ARRAY order (order is meaning for a mark/entry list)', () => {
    expect(stableStringify([1, 2, 3])).not.toBe(stableStringify([3, 2, 1]));
    expect(hashValue([1, 2, 3])).not.toBe(hashValue([3, 2, 1]));
  });

  it('SENSITIVE to a value change (a stale body/wiki gets a new hash)', () => {
    const before = { name: 'Maren', facts: [{ key: 'eyes', value: 'grey' }] };
    const after = { name: 'Maren', facts: [{ key: 'eyes', value: 'green' }] };
    expect(hashValue(before)).not.toBe(hashValue(after));
  });

  it('SENSITIVE to an added/removed field', () => {
    const before = { name: 'Maren' };
    const after = { name: 'Maren', summary: 'a lantern-keeper' };
    expect(hashValue(before)).not.toBe(hashValue(after));
  });

  it('distinguishes null / missing / falsy so an absent value is not a match', () => {
    expect(hashValue({ a: null })).not.toBe(hashValue({}));
    expect(hashValue({ a: null })).not.toBe(hashValue({ a: 0 }));
    expect(hashValue({ a: false })).not.toBe(hashValue({ a: 0 }));
  });

  it('hashValue is exactly sha1 of the stable stringification', () => {
    const v = { b: 2, a: 1 };
    expect(hashValue(v)).toBe(sha1(stableStringify(v)));
    expect(stableStringify(v)).toBe('{"a":1,"b":2}');
  });
});
