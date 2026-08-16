/**
 * sha1 helper for stable mark keys:
 * markKey = sha1(ruleId | normalizedQuote | entryId).
 *
 * Uses Node's crypto so the engine stays dependency-free. This module is pure
 * (no state); it runs server-side at page load and client-side while typing.
 */
import { createHash } from 'node:crypto';

export function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

/**
 * Deterministic JSON stringify: object keys are emitted in sorted order at every
 * depth so two structurally-equal values hash identically regardless of the key
 * insertion order the DB/driver happened to produce. Arrays keep their order
 * (order IS meaning for a list of marks/entries). Used to hash the chapter body
 * and the wiki snapshot for the AI-check cache invalidation signal (T-AICACHE).
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** sha1 of the deterministic stringification of any JSON-serializable value. */
export function hashValue(value: unknown): string {
  return sha1(stableStringify(value));
}
