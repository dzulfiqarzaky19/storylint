import { describe, expect, it } from 'vitest';

import type { ResolvedTie } from '@/domain/types';
import { resolveDanglingTies } from './danglingTies';

const tieTo = (toEntryId: string, toName: string): ResolvedTie => ({
  id: `maren>${toEntryId}`,
  fromEntryId: 'maren',
  toEntryId,
  rel: 'knows',
  toName,
  toKind: 'character',
  toCatalogueNo: '—',
});

describe('resolveDanglingTies', () => {
  const LIVE = tieTo('tobin', 'Tobin Ash');
  const DEAD = tieTo('osk', 'Saint Osk');

  it('marks a tie to a deleted entry as tombstoned and keeps the removed name', () => {
    expect(resolveDanglingTies(new Set(['tobin']), [DEAD])).toEqual([
      { tie: DEAD, tombstoned: true, removedName: 'Saint Osk' },
    ]);
  });

  it('leaves a tie to a live entry as it is', () => {
    expect(resolveDanglingTies(new Set(['tobin']), [LIVE])).toEqual([{ tie: LIVE, tombstoned: false }]);
  });

  it('keeps the ties in their original order', () => {
    const resolved = resolveDanglingTies(new Set(['tobin']), [DEAD, LIVE]);

    expect(resolved.map((r) => r.tombstoned)).toEqual([true, false]);
  });

  it('returns nothing for an entry with no ties', () => {
    expect(resolveDanglingTies(new Set(['tobin']), [])).toEqual([]);
  });
});
