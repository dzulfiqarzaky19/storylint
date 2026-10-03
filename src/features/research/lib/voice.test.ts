import { describe, expect, it } from 'vitest';

import { COLLABORATOR_LABEL, LEGACY_THEM_LABEL, voiceLabel } from './voice';

describe('voiceLabel', () => {
  it('shows turns saved under the legacy label as the collaborator', () => {
    expect(voiceLabel(LEGACY_THEM_LABEL)).toBe(COLLABORATOR_LABEL);
  });

  it('shows any other speaker under their own name', () => {
    expect(voiceLabel('You')).toBe('You');
  });
});
