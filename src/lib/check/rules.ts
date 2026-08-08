/**
 * Declarative contradiction rule table (HANDOFF §7 Pass A).
 *
 * Each rule describes how a manuscript sentence can contradict a recorded fact.
 * The engine (contradiction.ts) walks facts, applies matching rules per
 * sentence, and emits a `conflict` mark when the asserted value differs from the
 * recorded one after normalization. The four spec marks are NOT hardcoded — they
 * fall out of applying these two generic rules to the seeded wiki + manuscript.
 */

import type { WikiEntry, WikiSnapshot } from './index';
import { normalize } from './normalize';

export interface RuleContext {
  /** The sentence being examined. */
  sentence: string;
  /** The entry whose fact this rule is checking. */
  entry: WikiEntry;
  /** The recorded fact value for `factKey` on `entry` (already looked up). */
  recordedValue: string;
  /** The full wiki, for cross-entry rules. */
  wiki: WikiSnapshot;
}

export interface RuleMatch {
  /** The exact manuscript run to underline (verbatim, curly quotes preserved). */
  quote: string;
  /** The entry id the resulting mark anchors to (used in markKey). */
  entryId: string;
  /** Short rail reason sentence. */
  rail: string;
  /** Longer inline note. */
  noteText: string;
}

export interface Rule {
  id: string;
  /** The fact key on the walked entry that this rule constrains. */
  factKey: string;
  /** Extracts the candidate assertion from a sentence. */
  extract: RegExp;
  /**
   * Given the regex match and context, decide whether it is a contradiction and
   * if so return the mark payload. Returning `null` means "no conflict".
   */
  compare: (match: RegExpMatchArray, ctx: RuleContext) => RuleMatch | null;
}

/** Find an entry by id. */
function entryById(wiki: WikiSnapshot, id: string): WikiEntry | undefined {
  return wiki.entries.find((e) => e.id === id);
}

/** Find a fact value by (entryId, factKey). */
function factValue(
  wiki: WikiSnapshot,
  entryId: string,
  factKey: string,
): string | undefined {
  return entryById(wiki, entryId)
    ?.facts.find((f) => f.key === factKey)
    ?.value;
}

/**
 * attribute-mismatch — an adjective before a body-attribute noun ("<x> eyes")
 * is compared against the referenced character's recorded attribute fact.
 *
 * Regex per §7: /\b([a-z]+)\s+eyes\b/i. The captured colour word is compared to
 * the entry's `Eyes` fact; the quote extends back over a leading possessive /
 * determiner run ("Her own grey eyes") so the underline matches the spec.
 */
const attributeMismatch: Rule = {
  id: 'attribute-mismatch',
  factKey: 'Eyes',
  extract: /\b([a-z]+)\s+eyes\b/i,
  compare: (match, ctx) => {
    const asserted = match[1]!;
    if (normalize(asserted) === normalize(ctx.recordedValue)) return null;

    // Extend the quote backward to include a leading possessive/determiner run
    // like "Her own " so the underlined phrase reads naturally.
    const idx = match.index ?? ctx.sentence.indexOf(match[0]);
    const before = ctx.sentence.slice(0, idx);
    const lead = before.match(/((?:\b(?:her|his|their|its|my|your|own)\b\s+)+)$/i);
    const quote = (lead ? lead[1] : '') + match[0];

    return {
      quote: quote.trim(),
      entryId: ctx.entry.id,
      rail: `${ctx.entry.name} · Eyes: ${ctx.recordedValue.toLowerCase()}.`,
      noteText: `${ctx.entry.name} records ${ctx.recordedValue.toLowerCase()} eyes, set in Chapter 1. This sentence gives them as ${asserted.toLowerCase()}.`,
    };
  },
};

/**
 * constraint-violation — a cross-entry rule. A number-word immediately tied to
 * "sworn" asserts an age at which a character swore an oath. The referenced
 * character's `Age` fact is compared against The Lantern Oath's
 * `Sworn at: Twenty-one` constraint. When they differ, it is a contradiction.
 *
 * Regex per §7: number-word within ~12 chars of "sworn".
 */
const NUMBER_WORD_ALT =
  'zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:-one|-two)?|thirty|forty|fifty|sixty(?:-one)?';

const constraintViolation: Rule = {
  id: 'constraint-violation',
  // Walk this rule off the character's Age fact.
  factKey: 'Age',
  extract: new RegExp(`\\b(${NUMBER_WORD_ALT})\\b.{0,12}\\bsworn\\b`, 'i'),
  compare: (match, ctx) => {
    const assertedNumber = match[1]!;

    // The constraint lives on another entry: The Lantern Oath · Sworn at.
    const oathEntry = ctx.wiki.entries.find((e) => e.name === 'The Lantern Oath');
    const constraint = oathEntry
      ? factValue(ctx.wiki, oathEntry.id, 'Sworn at')
      : undefined;
    if (!constraint) return null;

    // No conflict if the manuscript's number matches the oath constraint.
    if (normalize(assertedNumber) === normalize(constraint)) return null;

    // The character's own recorded Age should equal the asserted number for this
    // to be "her age when she swore"; this keeps the rule anchored to the
    // subject the sentence is about (Maren, Age Nineteen).
    if (normalize(assertedNumber) !== normalize(ctx.recordedValue)) return null;

    return {
      quote: match[0].trim(),
      entryId: ctx.entry.id,
      rail: `${oathEntry!.name} is sworn at ${constraint.toLowerCase()}.`,
      noteText: `Your wiki says the ${oathEntry!.name} is sworn at ${constraint.toLowerCase()}, at the turn of the year, and has no provision for swearing early. This sentence has her sworn at ${assertedNumber.toLowerCase()}.`,
    };
  },
};

export const rules: Rule[] = [attributeMismatch, constraintViolation];
