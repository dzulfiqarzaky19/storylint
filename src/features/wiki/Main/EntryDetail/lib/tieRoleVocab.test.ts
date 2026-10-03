import { describe, expect, it } from 'vitest';

import { ROLE_VOCAB, roleVocabFor } from './tieRoleVocab';

describe('roleVocabFor', () => {
  it.each(['character', 'world', 'organization', 'lore'] as const)(
    'offers the %s vocabulary for a built-in %s category',
    (kind) => {
      expect(roleVocabFor(kind)).toBe(ROLE_VOCAB[kind]);
    },
  );

  it('offers the lore vocabulary for a custom category', () => {
    expect(roleVocabFor('ships')).toBe(ROLE_VOCAB.lore);
  });

  it.each(Object.entries(ROLE_VOCAB))('lists each %s role once', (_kind, roles) => {
    expect(new Set(roles).size).toBe(roles.length);
  });
});
