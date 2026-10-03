import { describe, expect, it } from 'vitest';

import {
  AI_CONFLICT_RULE_ID,
  AI_MISSING_RULE_ID,
  AI_NEW_ENTITY_RULE_ID,
  aiResultToMarks,
  mergeMarks,
} from './ai';
import { mark } from './testing/wiki';

const PARAGRAPHS = ['The chair had four legs.', 'Saint Osk watched from the wall.'];

describe('aiResultToMarks', () => {
  it('returns nothing for an empty response', () => {
    expect(aiResultToMarks({}, PARAGRAPHS)).toEqual([]);
  });

  describe('grounding', () => {
    it('drops a finding whose quote is not in the manuscript', () => {
      const marks = aiResultToMarks({ conflicts: [{ quote: 'five legs' }] }, PARAGRAPHS);

      expect(marks).toEqual([]);
    });

    it('drops a finding with a blank quote', () => {
      expect(aiResultToMarks({ conflicts: [{ quote: '   ' }] }, PARAGRAPHS)).toEqual([]);
    });

    it('anchors a finding to the paragraph its quote is in', () => {
      const [found] = aiResultToMarks({ newEntity: [{ quote: 'Saint Osk' }] }, PARAGRAPHS);

      expect(found?.position).toEqual({ paragraphIndex: 1, occurrenceIndex: 0 });
    });

    it('uses the paragraph hint to choose between two paragraphs holding the quote', () => {
      const twice = ['four legs here', 'four legs there'];

      const [found] = aiResultToMarks({ conflicts: [{ quote: 'four legs' }] }, twice, {
        preferredIndexByQuote: { 'four legs': 1 },
      });

      expect(found?.position.paragraphIndex).toBe(1);
    });

    it('falls back to the first matching paragraph when the hint is wrong', () => {
      const [found] = aiResultToMarks({ conflicts: [{ quote: 'four legs' }] }, PARAGRAPHS, {
        preferredIndexByQuote: { 'four legs': 1 },
      });

      expect(found?.position.paragraphIndex).toBe(0);
    });
  });

  describe('conflicts', () => {
    const CONFLICT = {
      quote: 'four legs',
      entryId: 'chair',
      factKey: 'Legs',
      reason: 'The wiki gives it five legs.',
      recorded: 'Five',
      suggested: 'Four',
    };

    it('maps a conflict to a mark that targets the fact it contradicts', () => {
      const [found] = aiResultToMarks({ conflicts: [CONFLICT] }, PARAGRAPHS);

      expect(found).toMatchObject({
        kind: 'conflict',
        ruleId: AI_CONFLICT_RULE_ID,
        quote: 'four legs',
        entityId: 'chair',
        rail: 'The wiki gives it five legs.',
        noteText: 'The wiki gives it five legs. Your wiki records: Five.',
        checkedAgainst: { entryId: 'chair', factKey: 'Legs', recordedValue: 'Five' },
        resolvedTarget: { entry: { id: 'chair' }, fact: { key: 'Legs', value: 'Four' } },
      });
    });

    it('attaches the fact id when the caller can resolve entry and key to one', () => {
      const [found] = aiResultToMarks({ conflicts: [CONFLICT] }, PARAGRAPHS, {
        factIdByEntryKey: { 'chair\u0000Legs': 'fact-7' },
      });

      expect(found?.checkedAgainst?.factId).toBe('fact-7');
    });

    it('never invents a fact id the caller did not supply', () => {
      const [found] = aiResultToMarks({ conflicts: [CONFLICT] }, PARAGRAPHS);

      expect(found?.checkedAgainst).not.toHaveProperty('factId');
    });

    it('gives the same mark for a bracketed entry id as for a bare one', () => {
      const [bare] = aiResultToMarks({ conflicts: [CONFLICT] }, PARAGRAPHS);
      const [bracketed] = aiResultToMarks(
        { conflicts: [{ ...CONFLICT, entryId: '[chair]' }] },
        PARAGRAPHS,
      );

      expect(bracketed?.markKey).toBe(bare?.markKey);
      expect(bracketed?.entityId).toBe('chair');
    });

    it('reports a finding the model repeats only once', () => {
      expect(aiResultToMarks({ conflicts: [CONFLICT, CONFLICT] }, PARAGRAPHS)).toHaveLength(1);
    });

    it('supplies a default reason and no write target when the model gives only a quote', () => {
      const [found] = aiResultToMarks({ conflicts: [{ quote: 'four legs' }] }, PARAGRAPHS);

      expect(found?.rail).toBe('This contradicts your wiki.');
      expect(found).not.toHaveProperty('resolvedTarget');
      expect(found).not.toHaveProperty('checkedAgainst');
      expect(found?.entityId).toBeUndefined();
    });
  });

  describe('missing facts', () => {
    it('targets the known entry and proposed fact', () => {
      const [found] = aiResultToMarks(
        { missing: [{ quote: 'four legs', entryId: 'chair', key: 'Legs', value: 'Four' }] },
        PARAGRAPHS,
      );

      expect(found).toMatchObject({
        kind: 'missing',
        ruleId: AI_MISSING_RULE_ID,
        resolvedTarget: { entry: { id: 'chair' }, fact: { key: 'Legs', value: 'Four' } },
        checkedAgainst: { entryId: 'chair' },
      });
    });

    it('proposes no fact when the model gives a key without a value', () => {
      const [found] = aiResultToMarks(
        { missing: [{ quote: 'four legs', entryId: 'chair', key: 'Legs' }] },
        PARAGRAPHS,
      );

      expect(found?.resolvedTarget).toEqual({ category: {}, entry: { id: 'chair' } });
    });

    it('leaves the target for the writer to pick when the subject is unknown', () => {
      const [found] = aiResultToMarks({ missing: [{ quote: 'four legs' }] }, PARAGRAPHS);

      expect(found).not.toHaveProperty('resolvedTarget');
    });
  });

  describe('new entities', () => {
    it('proposes a new entry with the given name and kind', () => {
      const [found] = aiResultToMarks(
        { newEntity: [{ quote: 'Saint Osk', name: 'Saint Osk', kind: ' Character ' }] },
        PARAGRAPHS,
      );

      expect(found).toMatchObject({
        kind: 'missing',
        ruleId: AI_NEW_ENTITY_RULE_ID,
        rail: 'New character to record: Saint Osk',
        resolvedTarget: {
          category: { proposeName: 'character' },
          entry: { proposeName: 'Saint Osk', proposeKind: 'character' },
        },
      });
    });

    it.each([['Deity'], [''], [undefined]])('clamps the kind %j to lore', (kind) => {
      const [found] = aiResultToMarks({ newEntity: [{ quote: 'Saint Osk', kind }] }, PARAGRAPHS);

      expect(found?.resolvedTarget?.entry.proposeKind).toBe('lore');
    });

    it('keeps a missing fact and a new entity on the same quote as two marks', () => {
      const marks = aiResultToMarks(
        { missing: [{ quote: 'Saint Osk' }], newEntity: [{ quote: 'Saint Osk' }] },
        PARAGRAPHS,
      );

      expect(marks.map((m) => m.ruleId)).toEqual([AI_MISSING_RULE_ID, AI_NEW_ENTITY_RULE_ID]);
    });
  });
});

describe('mergeMarks', () => {
  it('keeps every deterministic mark and adds the AI marks after them', () => {
    const merged = mergeMarks([mark({ markKey: 'd1' })], [mark({ markKey: 'a1' })]);

    expect(merged.map((m) => m.markKey)).toEqual(['d1', 'a1']);
  });

  it('lets the deterministic mark win when both share a key', () => {
    const deterministic = mark({ markKey: 'same', rail: 'deterministic' });
    const ai = mark({ markKey: 'same', rail: 'ai' });

    expect(mergeMarks([deterministic], [ai])).toEqual([deterministic]);
  });

  it('returns nothing for two empty lists', () => {
    expect(mergeMarks([], [])).toEqual([]);
  });
});
