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

function normalizeToken(token: string): string {
  if (NUMBER_WORDS[token] !== undefined) return NUMBER_WORDS[token];
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

export function normalize(value: string): string {
  const lowered = value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (lowered === '') return '';

  let tokens = lowered.split(' ');

  if (tokens.length > 1 && ARTICLES.has(tokens[0]!)) {
    tokens = tokens.slice(1);
  }

  return tokens.map(normalizeToken).join(' ');
}

export function normalizeQuote(quote: string): string {
  return quote.replace(/\u2019/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();
}
