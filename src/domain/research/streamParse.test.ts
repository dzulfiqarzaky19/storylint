import { describe, expect, it } from 'vitest';

import { CARDS_SENTINEL, splitStreamedAnswer, visibleProsePrefix } from './streamParse';

const CARD = { kind: 'fact', title: 'The oath', body: 'Sworn at sixteen.' };
const withCards = (reply: string, json: string) => `${reply}${CARDS_SENTINEL}${json}`;

describe('splitStreamedAnswer', () => {
  it('returns the whole buffer as the reply when there is no cards block', () => {
    expect(splitStreamedAnswer('  The keeper swears at sixteen. ')).toEqual({
      reply: 'The keeper swears at sixteen.',
      cards: [],
    });
  });

  it('splits the reply from the cards that follow the sentinel', () => {
    const result = splitStreamedAnswer(withCards('The keeper swears.\n', JSON.stringify([CARD])));

    expect(result).toEqual({ reply: 'The keeper swears.', cards: [CARD] });
  });

  it('reads cards wrapped in a json code fence', () => {
    const fenced = '```json\n' + JSON.stringify([CARD]) + '\n```';

    expect(splitStreamedAnswer(withCards('Reply', fenced)).cards).toEqual([CARD]);
  });

  it.each([
    ['is not valid JSON', '[{"title": '],
    ['is not an array', JSON.stringify(CARD)],
    ['is empty', '   '],
  ])('returns no cards when the cards block %s, and still keeps the reply', (_name, json) => {
    expect(splitStreamedAnswer(withCards('Reply', json))).toEqual({ reply: 'Reply', cards: [] });
  });

  it('drops entries that are not objects or have neither a title nor a body', () => {
    const json = JSON.stringify([CARD, 'text', null, { kind: 'fact' }, { body: 'Body only' }]);

    expect(splitStreamedAnswer(withCards('Reply', json)).cards).toEqual([CARD, { body: 'Body only' }]);
  });

  it('keeps at most three cards', () => {
    const json = JSON.stringify([1, 2, 3, 4].map((n) => ({ title: `Card ${n}` })));

    expect(splitStreamedAnswer(withCards('Reply', json)).cards.map((c) => c.title)).toEqual([
      'Card 1',
      'Card 2',
      'Card 3',
    ]);
  });

  it('strips a sentinel that has only partly arrived from the end of the reply', () => {
    const partial = CARDS_SENTINEL.slice(0, 6);

    expect(splitStreamedAnswer(`The keeper swears.${partial}`).reply).toBe('The keeper swears.');
  });
});

describe('visibleProsePrefix', () => {
  it('shows everything before the sentinel', () => {
    expect(visibleProsePrefix(withCards('The keeper swears.', '[{"title"'))).toBe('The keeper swears.');
  });

  it('hides a sentinel that has only partly arrived', () => {
    const partial = CARDS_SENTINEL.slice(0, 4);

    expect(visibleProsePrefix(`The keeper swears.${partial}`)).toBe('The keeper swears.');
  });

  it('shows the buffer unchanged while no sentinel is in sight', () => {
    expect(visibleProsePrefix('The keeper swears. ')).toBe('The keeper swears. ');
  });
});
