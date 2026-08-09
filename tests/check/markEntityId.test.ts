/**
 * Mark.entityId invariance (scale fast-follow — exact-anchor plumbing).
 *
 * The engine now SURFACES the wiki entry each mark is anchored to as
 * `Mark.entityId`, so explainMark can pin retrieval to that exact entry instead
 * of re-deriving it from a substring scan. This is purely CARRYING a value the
 * engine already computed: entityId is already an input to
 * `markKey = sha1(ruleId | normalizedQuote | entryId)` at all three construction
 * sites. Surfacing it must therefore be provably behavior-neutral.
 *
 * This test locks two things across ALL three mark kinds the seed produces
 * (conflict, missing-with-owner, and — via the AI fixture below — an ownerless
 * missing):
 *   (1) markKey is BYTE-IDENTICAL to sha1(ruleId | normalizedQuote | entryId).
 *       If entityId ever drifted from the id that fed the hash, this reds.
 *   (2) Mark.entityId === the exact id that fed that hash (or undefined when the
 *       anchor is empty), proving we carried the SAME value, not a re-derivation.
 *
 * Pure in-memory: real engine over the seed fixture, no DB, no model, no reseed.
 */

import { describe, it, expect } from 'vitest';
import { checkManuscript } from '@/lib/check';
import { aiResultToMarks } from '@/lib/check/ai';
import {
  wiki,
  chapter7Paragraphs,
  expectedMarks,
  markKeyOf,
  RULE_IDS,
} from './fixtures';

// The seeded Chapter 7 emits m1 (conflict/maren), m2 (missing/maren),
// m3 (missing/vergelight), m4 (conflict/maren) — a conflict AND a
// missing-with-owner, both anchored to a real entry.
describe('Mark.entityId — deterministic engine (conflict + missing-with-owner)', () => {
  const { marks } = checkManuscript({ paragraphs: chapter7Paragraphs, wiki });

  it('carries the exact anchor id onto every seeded mark', () => {
    for (const expected of expectedMarks) {
      const mark = marks.find((m) => m.quote === expected.quote);
      expect(mark, `mark for "${expected.quote}"`).toBeDefined();
      // (2) entityId is the SAME id the fixture says anchors this mark.
      expect(mark!.entityId, `${expected.id} entityId`).toBe(expected.entryId);
    }
  });

  it('markKey stays byte-identical to sha1(ruleId | normalizedQuote | entryId)', () => {
    for (const expected of expectedMarks) {
      const mark = marks.find((m) => m.quote === expected.quote)!;
      // The ruleId differs per kind; recompute the documented key from the SAME
      // entityId now surfaced on the mark. Byte-equality proves surfacing the
      // value did not perturb the hash input.
      const ruleId =
        mark.kind === 'missing'
          ? RULE_IDS.unrecorded
          : mark.ruleId; // conflict rules own their id (attribute/constraint)
      const key = markKeyOf(ruleId, expected.quote, mark.entityId ?? '');
      expect(mark.markKey, `${expected.id} markKey`).toBe(key);
    }
  });
});

// The AI path is the third kind: a conflict carries the model-echoed entryId,
// while an AI `missing` has NO recorded owner yet -> entityId must be undefined
// (not '') so the explainMark focusEntityIds seam never receives a blank anchor.
describe('Mark.entityId — AI path (echoed conflict id + ownerless missing)', () => {
  const paragraphs = [
    'She turned a brass key in the lock of the Quiet Sept door.',
  ];
  const marks = aiResultToMarks(
    {
      conflicts: [
        {
          quote: 'brass key',
          entryId: 'ironkey',
          reason: 'The key is black iron, not brass.',
          recorded: 'black iron',
        },
      ],
      missing: [{ quote: 'the Quiet Sept door', reason: 'Not written down yet.' }],
    } as Parameters<typeof aiResultToMarks>[0],
    paragraphs,
  );

  it('a conflict carries the model-echoed entryId', () => {
    const conflict = marks.find((m) => m.kind === 'conflict');
    expect(conflict, 'AI conflict mark').toBeDefined();
    expect(conflict!.entityId).toBe('ironkey');
  });

  it('an ownerless missing has entityId undefined, never an empty string', () => {
    const missing = marks.find((m) => m.kind === 'missing');
    expect(missing, 'AI missing mark').toBeDefined();
    // The load-bearing distinction: '' would pin a blank anchor in explainMark;
    // undefined is the honest "no anchor". MUTATION: change ai.ts back to
    // `entityId: entry` (without `|| undefined`) -> this becomes '' and reds.
    expect(missing!.entityId).toBeUndefined();
  });
});
