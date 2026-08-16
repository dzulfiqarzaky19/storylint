/**
 * Normalization shared by both check passes.
 *
 * Folds equivalent surface forms so the manuscript can be compared against the
 * wiki without spurious mismatches:
 *   - number-words ↔ digits   (nineteen → 19, twenty-one → 21)
 *   - casing                   (Green → green)
 *   - leading articles         (a / an / the dropped)
 *   - simple plurals           (eyes → eye, rings → ring)
 *
 * Pure, deterministic, no dependencies. The canonical form chosen here is the
 * DIGIT form for numbers and the lower-cased singular for words; the tests only
 * require that equivalent inputs collapse to the same output.
 */

// Number-words → digits. Kept small and explicit: the domain only uses a
// handful of ages/counts. Compound tens ("twenty-one") included as whole tokens
// because the seed data writes them hyphenated.
const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
  'twenty-one': '21',
  'twenty-two': '22',
  'twenty-three': '23',
  'twenty-four': '24',
  'twenty-five': '25',
  'twenty-six': '26',
  'twenty-seven': '27',
  'twenty-eight': '28',
  'twenty-nine': '29',
  thirty: '30',
  'thirty-one': '31',
  'thirty-two': '32',
  'thirty-three': '33',
  'thirty-four': '34',
  'thirty-five': '35',
  'thirty-six': '36',
  'thirty-seven': '37',
  'thirty-eight': '38',
  'thirty-nine': '39',
  forty: '40',
  fifty: '50',
  sixty: '60',
  'sixty-one': '61',
};

const ARTICLES = new Set(['a', 'an', 'the']);

/** Fold a single already-lowercased token: number-word → digit, plural → singular. */
function normalizeToken(token: string): string {
  if (NUMBER_WORDS[token] !== undefined) return NUMBER_WORDS[token];
  // Simple plural fold: trailing "s" but not "ss" (e.g. "glass" stays "glass").
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

/**
 * Normalize a word or phrase to its canonical comparison form.
 * Splits on whitespace, drops a single leading article, folds each token.
 */
export function normalize(value: string): string {
  const lowered = value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (lowered === '') return '';

  let tokens = lowered.split(' ');

  // Drop a single leading article.
  if (tokens.length > 1 && ARTICLES.has(tokens[0]!)) {
    tokens = tokens.slice(1);
  }

  return tokens.map(normalizeToken).join(' ');
}

/**
 * A lighter normalization for the stable mark key: unify apostrophes + lower-case
 * + collapse whitespace only. This is deliberately NOT the semantic `normalize`
 * above: markKey must stay stable and match the documented
 * `sha1(ruleId | normalizedQuote | entryId)` where normalizedQuote is the quote
 * with casing/whitespace folded but its words otherwise intact.
 *
 * The curly apostrophe (U+2019) is folded to the straight one (U+0027) FIRST, so
 * a phrase written straight in one chapter and curly in another yields ONE key.
 * Without this, "her mother's brass ring" (straight) and its curly twin produce
 * two markKeys and the /wiki poster band shows the same detail twice. Direction
 * (curly -> straight) matches `phraseIndexKey` in unrecorded.ts, keeping the two
 * key paths consistent.
 */
export function normalizeQuote(quote: string): string {
  return quote.replace(/\u2019/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();
}
