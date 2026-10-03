import { describe, expect, it } from 'vitest';

import { projectSuggestion } from './suggestions';
import { mark } from './testing/wiki';

describe('projectSuggestion', () => {
  it('projects nothing for a conflict mark', () => {
    expect(projectSuggestion(mark({ kind: 'conflict' }))).toBeNull();
  });

  it('proposes the quote itself as both key and value for an unknown phrase', () => {
    const suggestion = projectSuggestion(mark({ quote: 'his father’s iron key' }));

    expect(suggestion).toMatchObject({
      key: 'his father’s iron key',
      value: 'his father’s iron key',
    });
    expect(suggestion?.text).toContain('his father’s iron key');
  });

  it('uses the curated key and value for a phrase it has a projection for', () => {
    expect(projectSuggestion(mark({ quote: 'the tallow rule' }))).toMatchObject({
      key: 'Rule',
      value: 'The tallow rule — no oil in the Verge Light',
    });
  });

  it('finds the curated projection whatever the case or apostrophe style', () => {
    expect(projectSuggestion(mark({ quote: "Her Mother's brass ring" }))).toMatchObject({
      key: 'Carries',
    });
  });
});
