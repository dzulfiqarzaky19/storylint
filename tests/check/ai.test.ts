/**
 * AI-check mapping layer — pure, no network (src/lib/check/ai.ts).
 *
 * Covers the three things that must be right for AI findings to render safely:
 *   1. mapping AI JSON -> the same Mark shape the deterministic engine emits,
 *   2. the GROUNDING GUARD (drop any quote not verbatim in the manuscript),
 *   3. changed-paragraph diffing + reconciliation (cost control on save).
 */

import { describe, it, expect } from 'vitest';
import {
  aiResultToMarks,
  mergeMarks,
  paragraphHash,
  hashParagraphs,
  changedParagraphIndices,
  reconcileAiMarks,
  AI_CONFLICT_RULE_ID,
  AI_MISSING_RULE_ID,
  type AiCheckResponse,
} from '@/lib/check/ai';
import type { Mark } from '@/lib/check';

const paragraphs = [
  'The Sept had twenty-three members that winter, never more.',
  'She wore her grandmother’s iron key on a cord.',
];

describe('aiResultToMarks — mapping + grounding', () => {
  it('maps a verbatim conflict to a conflict Mark with a stable key', () => {
    const res: AiCheckResponse = {
      conflicts: [
        {
          quote: 'twenty-three members',
          entryId: 'sept',
          reason: 'The Quiet Sept has twenty-one members.',
          recorded: 'Members: Twenty-one, never more',
        },
      ],
    };
    const marks = aiResultToMarks(res, paragraphs);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.kind).toBe('conflict');
    expect(marks[0]!.ruleId).toBe(AI_CONFLICT_RULE_ID);
    expect(marks[0]!.quote).toBe('twenty-three members');
    expect(marks[0]!.position.paragraphIndex).toBe(0);
    expect(marks[0]!.markKey).toMatch(/^[0-9a-f]{40}$/);
    // Actions mirror the deterministic conflict set (rule-1-safe include path).
    expect(marks[0]!.actions.map((a) => a.id)).toEqual(['wiki', 'text', 'leave']);
  });

  it('maps a verbatim missing finding to a missing Mark', () => {
    const res: AiCheckResponse = {
      missing: [
        { quote: 'her grandmother’s iron key', reason: 'A new object, not in the wiki.' },
      ],
    };
    const marks = aiResultToMarks(res, paragraphs);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.kind).toBe('missing');
    expect(marks[0]!.ruleId).toBe(AI_MISSING_RULE_ID);
    expect(marks[0]!.position.paragraphIndex).toBe(1);
    expect(marks[0]!.actions.map((a) => a.id)).toEqual(['add', 'edit', 'leave']);
  });

  it('DROPS a hallucinated quote that is not verbatim in the manuscript', () => {
    const res: AiCheckResponse = {
      conflicts: [
        { quote: 'a dragon named Fyre', entryId: 'sept', reason: 'invented' },
      ],
      missing: [{ quote: 'the crystal throne', reason: 'invented' }],
    };
    const marks = aiResultToMarks(res, paragraphs);
    expect(marks).toHaveLength(0);
  });

  it('uses the model’s paragraph hint to disambiguate an identical substring', () => {
    const dup = ['the key turned twice', 'she found the key again'];
    const res: AiCheckResponse = {
      missing: [{ quote: 'the key', reason: 'x', ...( { paragraph: 1 } as object) }],
    };
    const marks = aiResultToMarks(res, dup, { preferredIndexByQuote: { 'the key': 1 } });
    expect(marks).toHaveLength(1);
    expect(marks[0]!.position.paragraphIndex).toBe(1);
  });

  it('de-duplicates identical findings', () => {
    const res: AiCheckResponse = {
      conflicts: [
        { quote: 'twenty-three members', entryId: 'sept', reason: 'a' },
        { quote: 'twenty-three members', entryId: 'sept', reason: 'a' },
      ],
    };
    expect(aiResultToMarks(res, paragraphs)).toHaveLength(1);
  });

  it('treats a bracketed entryId ("[sept]") as the bare id for a stable key', () => {
    // The live gateway sometimes echoes the gazetteer id with brackets. The
    // markKey must not change based on that formatting, else the same finding
    // would produce two different squiggles across checks.
    const bracketed: AiCheckResponse = {
      conflicts: [{ quote: 'twenty-three members', entryId: '[sept]', reason: 'a' }],
    };
    const bare: AiCheckResponse = {
      conflicts: [{ quote: 'twenty-three members', entryId: 'sept', reason: 'a' }],
    };
    const a = aiResultToMarks(bracketed, paragraphs);
    const b = aiResultToMarks(bare, paragraphs);
    expect(a).toHaveLength(1);
    expect(a[0]!.markKey).toBe(b[0]!.markKey);
  });
});

function fakeMark(paragraphIndex: number, key: string): Mark {
  return {
    markKey: key,
    kind: 'conflict',
    ruleId: 'ai-conflict',
    quote: `q${key}`,
    rail: 'r',
    noteText: 'n',
    actions: [],
    position: { paragraphIndex, occurrenceIndex: 0 },
  };
}

describe('mergeMarks', () => {
  it('unions by markKey, deterministic winning on collision', () => {
    const det = [fakeMark(0, 'k1')];
    const ai = [fakeMark(0, 'k1'), fakeMark(1, 'k2')];
    const merged = mergeMarks(det, ai);
    expect(merged.map((m) => m.markKey).sort()).toEqual(['k1', 'k2']);
  });
});

describe('changed-paragraph diffing', () => {
  it('first pass (no previous hashes) reports every paragraph', () => {
    expect(changedParagraphIndices(paragraphs, [])).toEqual([0, 1]);
  });

  it('reports only the paragraph that actually changed', () => {
    const prev = hashParagraphs(paragraphs);
    const edited = [...paragraphs];
    edited[1] = 'She wore her grandmother’s iron key on a leather cord.';
    expect(changedParagraphIndices(edited, prev)).toEqual([1]);
  });

  it('paragraphHash ignores whitespace-only differences', () => {
    expect(paragraphHash('a   b')).toBe(paragraphHash('a b'));
  });
});

describe('reconcileAiMarks', () => {
  it('keeps marks on untouched paragraphs and replaces those on changed ones', () => {
    const previous = [fakeMark(0, 'old0'), fakeMark(1, 'old1')];
    const fresh = [fakeMark(1, 'new1')];
    const out = reconcileAiMarks(previous, fresh, [1], 2);
    const keys = out.map((m) => m.markKey).sort();
    expect(keys).toEqual(['new1', 'old0']); // old1 dropped, old0 kept, new1 added
  });

  it('drops marks pointing past the current paragraph count (deleted paragraphs)', () => {
    const previous = [fakeMark(0, 'a'), fakeMark(2, 'b')];
    const out = reconcileAiMarks(previous, [], [], 1); // only paragraph 0 exists now
    expect(out.map((m) => m.markKey)).toEqual(['a']);
  });
});
