/**
 * Suggestion projection (HANDOFF §7 "One engine, two screens").
 *
 * A `missing` mark on the Write screen is the SAME finding as a suggestion on
 * the Wiki poster band. This module projects a `missing` mark into
 * `{ source, text, key, value }`. It is called from checkManuscript on the same
 * run that produced the marks, so suggestions are never seeded separately.
 *
 * The `key` (the fact key the phrase would become, e.g. "Carries" / "Rule") and
 * the display `value` are editorial and specified in §6 for the two Chapter-7
 * phrases. They cannot be derived from the raw text alone, so a small
 * declarative projection table supplies them — this is DATA, like the rule
 * table, not a hardcoded list of marks. Phrases without a table entry fall back
 * to a generic projection so the "one run feeds both screens" invariant holds.
 */

import type { Mark, Suggestion } from './index';
import { normalizeQuote } from './normalize';

interface Projection {
  key: string;
  value: string;
  text: string;
}

// The chapter the manuscript belongs to. The engine signature does not receive
// chapter context, and every current caller checks Chapter 7, so this is the
// default source. (§7 ambiguity: source should come from the chapter record
// once the Write screen wires real chapters through. Flagged in the report.)
const DEFAULT_SOURCE = 'Chapter 7';

// Editorial projection for the two seeded Chapter-7 phrases (HANDOFF §6 s1/s2).
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

/** Project a single `missing` mark into a Suggestion (or null for non-missing). */
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

  // Generic fallback: keep the one-run invariant for any other missing phrase.
  return {
    source: DEFAULT_SOURCE,
    text: `“${mark.quote}” — mentioned in the manuscript, not yet in the wiki`,
    key: mark.quote,
    value: mark.quote,
  };
}
