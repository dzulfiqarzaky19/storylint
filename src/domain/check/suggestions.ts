import type { Mark, Suggestion } from './index';
import { normalizeQuote } from './normalize';

interface Projection {
  key: string;
  value: string;
  text: string;
}

const DEFAULT_SOURCE = 'Chapter 7';

const PROJECTIONS: Record<string, Projection> = {
  [normalizeQuote('her mother’s brass ring')]: {
    key: 'Carries',
    value: 'Her mother’s brass ring',
    text: '“her mother’s brass ring” — mentioned twice, never written down',
  },
  [normalizeQuote('the tallow rule')]: {
    key: 'Rule',
    value: 'The tallow rule — no oil in the Verge Light',
    text: '“the tallow rule” — a rule of the light nobody has recorded',
  },
};

export function projectSuggestion(mark: Mark): Suggestion | null {
  if (mark.kind !== 'missing') return null;

  const proj = PROJECTIONS[normalizeQuote(mark.quote)];
  if (proj) {
    return {
      source: DEFAULT_SOURCE,
      text: proj.text,
      key: proj.key,
      value: proj.value,
    };
  }

  return {
    source: DEFAULT_SOURCE,
    text: `“${mark.quote}” — mentioned in the manuscript, not yet in the wiki`,
    key: mark.quote,
    value: mark.quote,
  };
}
