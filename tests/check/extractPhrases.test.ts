/**
 * Candidate-phrase extraction for the book-wide index (Tier 2).
 *
 * extractCandidatePhrases is wiki-free and mirrors the live engine's U1
 * (qualified possessed object) and U2 (named designator) shapes, mapping each
 * phrase to its occurrence count in the chapter. saveChapterBody feeds this into
 * the phrase_mentions table so the engine can rank marks by cross-chapter
 * recurrence.
 */

import { describe, it, expect } from 'vitest';
import { extractCandidatePhrases } from '@/lib/check/unrecorded';

describe('extractCandidatePhrases', () => {
  it('extracts qualified possessed objects and named designators', () => {
    const m = extractCandidatePhrases([
      'Maren turned her mother\u2019s brass ring twice.',
      'She obeyed the tallow rule before the water.',
    ]);
    // Keys are canonical: the curly apostrophe (U+2019) in the input folds to a
    // straight ' so a phrase written either way is ONE index entry.
    expect(m.get("her mother's brass ring")).toBe(1);
    expect(m.get('the tallow rule')).toBe(1);
    // The curly-apostrophe form is never a separate key.
    expect(m.get('her mother\u2019s brass ring')).toBeUndefined();
  });

  it('counts a phrase repeated within the chapter', () => {
    const m = extractCandidatePhrases([
      'She kept her mother\u2019s brass ring close.',
      'Her mother\u2019s brass ring turned in her pocket.',
    ]);
    expect(m.get("her mother's brass ring")).toBe(2);
  });

  it('folds curly and straight apostrophes to one key across paragraphs', () => {
    const m = extractCandidatePhrases([
      'She kept her mother\u2019s brass ring close.', // curly
      "Her mother's brass ring turned in her pocket.", // straight
    ]);
    // Both variants are the SAME phrase, counted twice, under one key.
    expect(m.get("her mother's brass ring")).toBe(2);
    expect([...m.keys()].filter((k) => k.includes('brass ring')).length).toBe(1);
  });

  it('skips bare-noun possessed objects (no wiki needed to reject "coat")', () => {
    const m = extractCandidatePhrases([
      'Maren stood in her mother\u2019s coat and did not cry.',
    ]);
    expect([...m.keys()].some((k) => k.includes('coat'))).toBe(false);
  });

  it('returns an empty map for text with no candidates', () => {
    const m = extractCandidatePhrases(['The tide went out and the gulls called.']);
    expect(m.size).toBe(0);
  });
});
