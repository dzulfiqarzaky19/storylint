/**
 * Engine contract — the highest-value surface in the project (HANDOFF §7).
 *
 * Against the seeded wiki and seeded Chapter 7, `checkManuscript` must emit
 * EXACTLY m1–m4 (right kinds + quotes) and EXACTLY s1–s2, in ONE run. Plus a
 * negative case (consistent manuscript → zero marks) and a regression that a
 * resolved markKey stays resolved across an edit.
 *
 * These tests are RED on purpose: the Phase-2 stub returns `{marks:[],
 * suggestions:[]}`. They fail as ASSERTIONS, not import errors. A later phase
 * implements the engine against them.
 */

import { describe, it, expect } from 'vitest';
import { checkManuscript } from '@/lib/check';
import type { Mark } from '@/lib/check';
import {
  wiki,
  chapter7Paragraphs,
  consistentParagraphs,
  expectedMarks,
  expectedSuggestions,
  markKeyOf,
  RULE_IDS,
} from './fixtures';

function quotes(marks: Mark[]): string[] {
  return marks.map((m) => m.quote);
}

function markByQuote(marks: Mark[], quote: string): Mark | undefined {
  return marks.find((m) => m.quote === quote);
}

describe('checkManuscript — seeded Chapter 7', () => {
  it('emits exactly four marks: m1–m4 with the right kinds and quotes', () => {
    const { marks } = checkManuscript({ paragraphs: chapter7Paragraphs, wiki });

    expect(marks).toHaveLength(4);

    // Exact set of quotes, order-independent.
    expect(new Set(quotes(marks))).toEqual(
      new Set(expectedMarks.map((m) => m.quote)),
    );

    for (const expected of expectedMarks) {
      const mark = markByQuote(marks, expected.quote);
      expect(mark, `mark for "${expected.quote}"`).toBeDefined();
      expect(mark!.kind, `${expected.id} kind`).toBe(expected.kind);
      expect(mark!.position.paragraphIndex, `${expected.id} paragraph`).toBe(
        expected.paragraphIndex,
      );
    }
  });

  it('m1 is a cross-entry conflict: Age Nineteen vs Lantern Oath sworn at twenty-one', () => {
    const { marks } = checkManuscript({ paragraphs: chapter7Paragraphs, wiki });
    const m1 = markByQuote(marks, 'nineteen and sworn');

    expect(m1).toBeDefined();
    expect(m1!.kind).toBe('conflict');
    expect(m1!.ruleId).toBe(RULE_IDS.constraintViolation);
    // §6: rail is the short reason sentence, not the kind label. The kind label
    // ('Contradiction') derives from kind === 'conflict'.
    expect(m1!.rail.toLowerCase()).toContain('twenty-one');
    // Rail one-liner and note reference the twenty-one constraint.
    expect(m1!.noteText.toLowerCase()).toContain('twenty-one');
    // Three actions in the spec: wiki / text / leave.
    expect(m1!.actions).toHaveLength(3);
    expect(m1!.actions.map((a) => a.id)).toEqual(['wiki', 'text', 'leave']);
  });

  it('m4 is an attribute-mismatch conflict: Maren Eyes green vs grey', () => {
    const { marks } = checkManuscript({ paragraphs: chapter7Paragraphs, wiki });
    const m4 = markByQuote(marks, 'Her own grey eyes');

    expect(m4).toBeDefined();
    expect(m4!.kind).toBe('conflict');
    expect(m4!.ruleId).toBe(RULE_IDS.attributeMismatch);
    // §6 rail: "Maren Vell · Eyes: green." — reason sentence, not kind label.
    expect(m4!.rail.toLowerCase()).toContain('green');
    expect(m4!.noteText.toLowerCase()).toContain('green');
  });

  it('m2 and m3 are missing (Unrecorded) marks with add/edit/leave actions', () => {
    const { marks } = checkManuscript({ paragraphs: chapter7Paragraphs, wiki });

    const m2 = markByQuote(marks, 'her mother’s brass ring');
    const m3 = markByQuote(marks, 'the tallow rule');

    for (const [id, mark] of [['m2', m2], ['m3', m3]] as const) {
      expect(mark, id).toBeDefined();
      expect(mark!.kind, `${id} kind`).toBe('missing');
      expect(mark!.ruleId, `${id} ruleId`).toBe(RULE_IDS.unrecorded);
      // §6 rail is the reason sentence (m2 "Mentioned twice, never written
      // down.", m3 "A rule of the light, nowhere in the wiki."), not the
      // 'Unrecorded' kind label. Assert it is a non-empty sentence.
      expect(mark!.rail.length, `${id} rail`).toBeGreaterThan(0);
      expect(mark!.actions.map((a) => a.id), `${id} actions`).toEqual([
        'add',
        'edit',
        'leave',
      ]);
    }
  });

  it('emits exactly two suggestions s1–s2, from the SAME run as the marks', () => {
    const { marks, suggestions } = checkManuscript({
      paragraphs: chapter7Paragraphs,
      wiki,
    });

    // One run produces both marks and suggestions.
    expect(marks.length).toBe(4);
    expect(suggestions).toHaveLength(2);

    for (const expected of expectedSuggestions) {
      const sug = suggestions.find((s) => s.key === expected.key);
      expect(sug, expected.id).toBeDefined();
      expect(sug!.source, `${expected.id} source`).toBe(expected.source);
      expect(sug!.value, `${expected.id} value`).toBe(expected.value);
    }
  });

  it('suggestions are the projection of the two missing marks (same phrases)', () => {
    const { marks, suggestions } = checkManuscript({
      paragraphs: chapter7Paragraphs,
      wiki,
    });

    const missingQuotes = marks
      .filter((m) => m.kind === 'missing')
      .map((m) => m.quote.toLowerCase());

    // s1/s2 values are the same phrases as m2/m3 (case-insensitive, ignoring
    // the trailing gloss on s2's value).
    expect(missingQuotes).toContain('her mother’s brass ring');
    expect(missingQuotes).toContain('the tallow rule');

    const values = suggestions.map((s) => s.value.toLowerCase());
    expect(values.some((v) => v.includes('mother’s brass ring'))).toBe(true);
    expect(values.some((v) => v.includes('tallow rule'))).toBe(true);
  });

  it('every mark carries a stable markKey = sha1(ruleId|normalizedQuote|entryId)', () => {
    const { marks } = checkManuscript({ paragraphs: chapter7Paragraphs, wiki });

    const m1 = markByQuote(marks, 'nineteen and sworn');
    expect(m1).toBeDefined();
    expect(m1!.markKey).toBe(
      markKeyOf(RULE_IDS.constraintViolation, 'nineteen and sworn', 'maren'),
    );

    // Keys are unique and non-empty.
    const keys = marks.map((m) => m.markKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe('checkManuscript — negative case', () => {
  it('a consistent manuscript produces zero marks and zero suggestions', () => {
    const { marks, suggestions } = checkManuscript({
      paragraphs: consistentParagraphs,
      wiki,
    });

    expect(marks).toHaveLength(0);
    expect(suggestions).toHaveLength(0);
  });
});

describe('checkManuscript — member-count rule (deterministic, no AI)', () => {
  it('flags a member count that contradicts the recorded Sept fact', () => {
    // Wiki records the Quiet Sept as "Twenty-one, never more".
    const paragraphs = ['The Sept had twenty-three members that winter, never more.'];
    const { marks } = checkManuscript({ paragraphs, wiki });

    const mark = markByQuote(marks, 'twenty-three members');
    expect(mark, 'a conflict mark for the wrong member count').toBeDefined();
    expect(mark!.kind).toBe('conflict');
    expect(mark!.ruleId).toBe('member-count');
    expect(mark!.position.paragraphIndex).toBe(0);
  });

  it('does NOT flag a member count that matches the recorded fact', () => {
    const paragraphs = ['The Sept had twenty-one members, never more.'];
    const { marks } = checkManuscript({ paragraphs, wiki });

    expect(marks.some((m) => m.ruleId === 'member-count')).toBe(false);
  });

  it('the seeded Chapter 7 still emits exactly four marks (rule adds none)', () => {
    // Chapter 7 says "twenty-one members" which matches the fact, so the new
    // rule must not perturb the canonical four-mark result.
    const { marks } = checkManuscript({ paragraphs: chapter7Paragraphs, wiki });
    expect(marks).toHaveLength(4);
    expect(marks.some((m) => m.ruleId === 'member-count')).toBe(false);
  });
});

describe('checkManuscript — regression: resolution survives edits', () => {
  it('a resolved markKey stays suppressed after an unrelated paragraph edit', () => {
    // First run: capture m1's key.
    const first = checkManuscript({ paragraphs: chapter7Paragraphs, wiki });
    const m1 = markByQuote(first.marks, 'nineteen and sworn');
    expect(m1).toBeDefined();
    const resolvedKey = m1!.markKey;

    // The user edits a DIFFERENT paragraph (insert a sentence into paragraph 4),
    // which shifts nothing about m1's quote/entity but changes the document.
    const edited = [...chapter7Paragraphs];
    edited[3] = edited[3] + ' The tide came back over the stones.';

    const second = checkManuscript({
      paragraphs: edited,
      wiki,
      resolvedMarkKeys: [resolvedKey],
    });

    // m1 must not reappear.
    expect(second.marks.some((m) => m.markKey === resolvedKey)).toBe(false);
    expect(second.marks.some((m) => m.quote === 'nineteen and sworn')).toBe(false);

    // The other three marks are unaffected.
    expect(second.marks).toHaveLength(3);
    expect(new Set(second.marks.map((m) => m.quote))).toEqual(
      new Set(['her mother’s brass ring', 'the tallow rule', 'Her own grey eyes']),
    );
  });

  it('a dismissed suggestion key stays suppressed', () => {
    const first = checkManuscript({ paragraphs: chapter7Paragraphs, wiki });
    // Suggestion keys are the fact keys (Carries / Rule) per §6.
    const dismissed = first.suggestions.map((s) => s.key)[0];
    expect(dismissed).toBeDefined();

    const second = checkManuscript({
      paragraphs: chapter7Paragraphs,
      wiki,
      dismissedSuggestionKeys: [dismissed!],
    });

    expect(second.suggestions.some((s) => s.key === dismissed)).toBe(false);
    expect(second.suggestions).toHaveLength(1);
  });
});
