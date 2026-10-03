import { describe, expect, it } from 'vitest';

import { snapshot, snapshotEntry } from '@/domain/testing/snapshot';
import { paragraphsToDoc } from '@/domain/write/adapters';
import { checkWiki, checkWikiBook, paragraphsFromBody } from './wikiCheck';

// OSK comes first on purpose: nothing below is about him, so no finding may land on him.
const OSK = snapshotEntry('osk', 'Saint Osk', { kind: 'lore' });
const MAREN = snapshotEntry('maren', 'Maren Vale', { facts: { Eyes: 'Grey' } });
const LIGHT = snapshotEntry('light', 'Verge Light', { kind: 'world', note: 'Burns tallow only' });
const WIKI = snapshot(OSK, MAREN, LIGHT);

const CONTRADICTION = 'Her green eyes narrowed.';
const UNRECORDED = 'They broke the tallow rule.';

const NOTHING_HIDDEN = { dismissedSuggestionKeys: [], resolvedMarkKeys: [] };

describe('paragraphsFromBody', () => {
  it('returns the text of each paragraph', () => {
    expect(paragraphsFromBody(paragraphsToDoc(['One.', 'Two.']))).toEqual(['One.', 'Two.']);
  });

  it('skips blocks that are not paragraphs', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body.' }] },
      ],
    };

    expect(paragraphsFromBody(doc)).toEqual(['Body.']);
  });

  it.each([[null], ['text'], [{}], [{ content: 'nope' }]])('returns no paragraphs for %j', (body) => {
    expect(paragraphsFromBody(body)).toEqual([]);
  });
});

describe('checkWiki', () => {
  it('reports a contradiction against the entry it is about', () => {
    const result = checkWiki({ snapshot: WIKI, paragraphs: [CONTRADICTION], ...NOTHING_HIDDEN });

    expect(result.contradictionEntryIds).toEqual(['maren']);
  });

  it('attaches a suggestion to the entry its phrase belongs to', () => {
    const result = checkWiki({ snapshot: WIKI, paragraphs: [UNRECORDED], ...NOTHING_HIDDEN });

    expect(result.suggestions).toMatchObject([{ suggestionKey: 'Rule', key: 'Rule', entryId: 'light' }]);
  });

  it('lists an entry once however many contradictions it has', () => {
    const result = checkWiki({
      snapshot: WIKI,
      paragraphs: [CONTRADICTION, 'Her brown eyes closed.'],
      ...NOTHING_HIDDEN,
    });

    expect(result.contradictionEntryIds).toEqual(['maren']);
  });

  it('leaves out a dismissed suggestion', () => {
    const result = checkWiki({
      snapshot: WIKI,
      paragraphs: [UNRECORDED],
      dismissedSuggestionKeys: ['Rule'],
      resolvedMarkKeys: [],
    });

    expect(result.suggestions).toEqual([]);
  });

  it('finds nothing in prose that agrees with the wiki', () => {
    const result = checkWiki({ snapshot: WIKI, paragraphs: ['Her grey eyes narrowed.'], ...NOTHING_HIDDEN });

    expect(result).toEqual({ suggestions: [], contradictionEntryIds: [] });
  });
});

describe('checkWikiBook', () => {
  const chapter = (number: number, ...paragraphs: string[]) => ({ number, body: paragraphsToDoc(paragraphs) });

  it('collects findings from every chapter', () => {
    const result = checkWikiBook({
      snapshot: WIKI,
      chapters: [chapter(1, CONTRADICTION), chapter(2, UNRECORDED)],
      ...NOTHING_HIDDEN,
    });

    expect(result.contradictionEntryIds).toEqual(['maren']);
    expect(result.suggestions.map((s) => s.suggestionKey)).toEqual(['Rule']);
  });

  it('reports a suggestion once, sourced to the earliest chapter that mentions it', () => {
    const result = checkWikiBook({
      snapshot: WIKI,
      chapters: [chapter(7, UNRECORDED), chapter(3, UNRECORDED)],
      ...NOTHING_HIDDEN,
    });

    expect(result.suggestions).toMatchObject([{ suggestionKey: 'Rule', source: 'Chapter 3' }]);
  });

  it('finds nothing in a book with no chapters', () => {
    const result = checkWikiBook({ snapshot: WIKI, chapters: [], ...NOTHING_HIDDEN });

    expect(result).toEqual({ suggestions: [], contradictionEntryIds: [] });
  });
});
