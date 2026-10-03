import type { CheckWiki } from './index';
import { normalize } from './normalize';
import { words } from './text';

export interface Lexicon {
  has: (phrase: string) => boolean;
}

export function buildLexicon(wiki: CheckWiki): Lexicon {
  const phrases = new Set<string>();
  const tokens = new Set<string>();

  const addPhrase = (raw: string) => {
    const n = normalize(raw);
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
      for (const part of fact.value.split(/[,;·]/)) addPhrase(part);
    }
  }

  const has = (phrase: string): boolean => {
    const n = normalize(phrase);
    if (n === '') return true;
    if (phrases.has(n)) return true;

    for (const p of phrases) {
      if (p === n) return true;
      if (p.includes(n) && n.length >= 3) return true;
    }

    const phraseTokens = words(phrase).map((w) => normalize(w));
    const content = phraseTokens.filter((t) => !STOPWORDS.has(t));
    if (content.length > 0 && content.every((t) => tokens.has(t))) return true;

    return false;
  };

  return { has };
}

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
