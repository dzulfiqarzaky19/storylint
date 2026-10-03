import { describe, expect, it } from 'vitest';

import type { EnrichCandidate } from '@/domain/research/recommendEnrichTarget';
import { resolveForEntry, routeEnrichTarget } from './resolveForEntry';

const candidate = (id: string, name: string, deletedAt: number | null = null): EnrichCandidate => ({
  id,
  name,
  kind: 'character',
  deletedAt,
});

const MAREN = candidate('maren', 'Maren Vale');
const LIGHT = candidate('light', 'Verge Light');

describe('resolveForEntry', () => {
  it('finds the entry the model named, ignoring case and stray spaces', () => {
    expect(resolveForEntry('  maren VALE ', [LIGHT, MAREN])).toEqual({ entryId: 'maren', name: 'Maren Vale' });
  });

  it('requires the whole name: a partial name does not match', () => {
    expect(resolveForEntry('Maren', [MAREN])).toBeNull();
  });

  it('never resolves to a deleted entry', () => {
    expect(resolveForEntry('Maren Vale', [candidate('maren', 'Maren Vale', 1_000)])).toBeNull();
  });

  it.each([[undefined], [''], ['   ']])('resolves nothing for %j', (forEntry) => {
    expect(resolveForEntry(forEntry, [MAREN])).toBeNull();
  });
});

describe('routeEnrichTarget', () => {
  it('prefers the entry the model named over one the title happens to match', () => {
    const target = routeEnrichTarget({ forEntry: 'Verge Light', title: 'Maren Vale', body: '' }, [MAREN, LIGHT]);

    expect(target?.entryId).toBe('light');
  });

  it('falls back to matching the title when the model named no entry', () => {
    const target = routeEnrichTarget({ title: 'Maren Vale and the oath', body: '' }, [MAREN, LIGHT]);

    expect(target?.entryId).toBe('maren');
  });

  it('falls back to matching the title when the named entry does not exist', () => {
    const target = routeEnrichTarget({ forEntry: 'Saint Osk', title: 'Maren Vale', body: '' }, [MAREN]);

    expect(target?.entryId).toBe('maren');
  });

  it('routes nowhere when neither the named entry nor the title matches', () => {
    expect(routeEnrichTarget({ forEntry: 'Saint Osk', title: 'The sea', body: '' }, [MAREN])).toBeNull();
  });
});
