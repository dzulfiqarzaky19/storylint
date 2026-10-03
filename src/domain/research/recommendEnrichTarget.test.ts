import { describe, expect, it } from 'vitest';

import { recommendEnrichTarget, type EnrichCandidate } from './recommendEnrichTarget';

const candidate = (id: string, name: string, deletedAt: number | null = null): EnrichCandidate => ({
  id,
  name,
  kind: 'character',
  deletedAt,
});

const MAREN = candidate('maren', 'Maren Vale');
const card = (title: string) => ({ title, body: '' });

describe('recommendEnrichTarget', () => {
  it.each([
    ['is the entry name', 'Maren Vale'],
    ['is the entry name in another case, with stray spaces', '  maren VALE '],
    ['contains the entry name', 'Maren Vale and the oath'],
    ['is contained in the entry name', 'Maren'],
  ])('recommends the entry when the card title %s', (_name, title) => {
    expect(recommendEnrichTarget(card(title), [MAREN])).toEqual({ entryId: 'maren', name: 'Maren Vale' });
  });

  it('prefers the longest matching name', () => {
    const entries = [candidate('vale', 'Vale'), MAREN, candidate('m', 'Maren')];

    expect(recommendEnrichTarget(card('Maren Vale at the light'), entries)?.entryId).toBe('maren');
  });

  it('never recommends a deleted entry', () => {
    expect(recommendEnrichTarget(card('Maren Vale'), [candidate('maren', 'Maren Vale', 1_000)])).toBeNull();
  });

  it('ignores an entry with a blank name', () => {
    expect(recommendEnrichTarget(card('Maren Vale'), [candidate('blank', '  ')])).toBeNull();
  });

  it.each([
    ['the title is blank', '   '],
    ['no entry matches', 'Saint Osk'],
  ])('recommends nothing when %s', (_name, title) => {
    expect(recommendEnrichTarget(card(title), [MAREN])).toBeNull();
  });
});
