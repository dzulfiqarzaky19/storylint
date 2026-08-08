/**
 * sha1 helper for stable mark keys (HANDOFF §7:
 * markKey = sha1(ruleId | normalizedQuote | entryId)).
 *
 * Uses Node's crypto so the engine stays dependency-free. This module is pure
 * (no state); it runs server-side at page load and client-side while typing.
 */
import { createHash } from 'node:crypto';

export function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}
