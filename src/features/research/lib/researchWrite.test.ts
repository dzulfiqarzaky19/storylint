import { describe, expect, it } from 'vitest';

import { planResearchWrite } from './researchWrite';
import type { PickerResult } from '@/lib/wiki/pickedTarget';

const RESULT: PickerResult = {
  categoryId: 'character',
  entryName: 'Maren',
  factKey: 'Title',
  factValue: 'The chair had four legs.',
};

describe('planResearchWrite', () => {
  it('pairs keep with KEEP_CARD and the same kept flag', () => {
    expect(
      planResearchWrite(
        { type: 'card.keep', propositionId: 'p1', kept: true },
        'w1',
      ),
    ).toEqual({
      action: { type: 'KEEP_CARD', propositionId: 'p1', kept: true },
      persist: { kind: 'keep', propositionId: 'p1', kept: true },
    });
  });

  it('pairs unkeep with the inverted flag, not a leftover true', () => {
    expect(
      planResearchWrite(
        { type: 'card.keep', propositionId: 'p1', kept: false },
        'w1',
      ).persist,
    ).toEqual({ kind: 'keep', propositionId: 'p1', kept: false });
  });

  it('pairs propose with PROPOSE_CARD of the same card', () => {
    expect(
      planResearchWrite({ type: 'card.propose', propositionId: 'p2' }, 'w1'),
    ).toEqual({
      action: { type: 'PROPOSE_CARD', propositionId: 'p2' },
      persist: { kind: 'propose', propositionId: 'p2' },
    });
  });

  it('pairs cancel with CANCEL_PENDING, no card id', () => {
    expect(planResearchWrite({ type: 'card.cancel' }, 'w1')).toEqual({
      action: { type: 'CANCEL_PENDING' },
      persist: { kind: 'cancel' },
    });
  });

  it('stamps confirmed:true, a card origin, and the active world on confirm', () => {
    const plan = planResearchWrite(
      { type: 'card.confirm', propositionId: 'p3', result: RESULT },
      'world-9',
    );
    expect(plan.action).toEqual({
      type: 'CONFIRM_CARD',
      propositionId: 'p3',
    });
    expect(plan.persist).toEqual({
      kind: 'confirm',
      result: RESULT,
      origin: { from: 'card', propositionId: 'p3' },
      worldId: 'world-9',
      confirmed: true,
    });
  });
});
