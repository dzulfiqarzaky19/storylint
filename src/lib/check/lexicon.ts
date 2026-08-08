/**
 * Lexicon — the "already written down" index (HANDOFF §7 Pass B).
 *
 * Built from entry names, aliases, notes, and every fact value, all normalized.
 * Pass B diffs candidate noun phrases from the manuscript against this index;
 * anything not already recorded becomes a `missing` mark.
 */

import type { WikiSnapshot } from './index';
import { normalize } from './normalize';
import { words } from './text';

export interface Lexicon {
  /** True if `phrase` is already recorded in the wiki (normalized comparison). */
  has: (phrase: string) => boolean;
}

/** Normalize a whole phrase token-by-token (mirrors normalize but keeps it here for clarity). */
function normalizePhrase(phrase: string): string {
  return normalize(phrase);
}

export function buildLexicon(wiki: WikiSnapshot): Lexicon {
  // Set of normalized phrases known to the wiki (names, aliases, fact values).
  const phrases = new Set<string>();
  // Set of individual recorded tokens (from names, aliases, notes, fact values),
  // used as a looser fallback so a single recorded noun ("tallow") is known.
  const tokens = new Set<string>();

  const addPhrase = (raw: string) => {
    const n = normalizePhrase(raw);
    if (n) phrases.add(n);
  };
  const addTokens = (raw: string) => {
    for (const w of words(raw)) tokens.add(normalize(w));
  };

  for (const entry of wiki.entries) {
    addPhrase(entry.name);
    addTokens(entry.name);
    for (const alias of entry.aliases ?? []) {
      addPhrase(alias);
      addTokens(alias);
    }
    if (entry.note) addTokens(entry.note);
    for (const fact of entry.facts) {
      addPhrase(fact.value);
      addTokens(fact.value);
      // Split multi-clause fact values ("Twenty-one, never more") on commas so
      // each clause is independently matchable.
      for (const part of fact.value.split(/[,;·]/)) addPhrase(part);
    }
  }

  const has = (phrase: string): boolean => {
    const n = normalizePhrase(phrase);
    if (n === '') return true;
    if (phrases.has(n)) return true;

    // Exact-name substring: the phrase equals or is contained by a known phrase
    // (e.g. "verge light" matches the entry name "Verge Light").
    for (const p of phrases) {
      if (p === n) return true;
      if (p.includes(n) && n.length >= 3) return true;
    }

    // Token fallback: every content token of the phrase is individually recorded.
    // This keeps known nouns (e.g. "tallow" from the note) from being flagged
    // when they appear in a recorded combination, while a genuinely new phrase
    // like "tallow rule" (rule is not recorded) still fails.
    const phraseTokens = words(phrase).map((w) => normalize(w));
    const content = phraseTokens.filter((t) => !STOPWORDS.has(t));
    if (content.length > 0 && content.every((t) => tokens.has(t))) return true;

    return false;
  };

  return { has };
}

// Words ignored when deciding whether every content token is recorded.
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'her',
  'his',
  'their',
  'its',
  'my',
  'your',
  'own',
  'of',
  'and',
  'in',
  'on',
  'at',
  'to',
  'with',
  'since',
]);
