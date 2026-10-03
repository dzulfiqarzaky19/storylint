import { describe, expect, it } from 'vitest';

import { snapshot, snapshotEntry } from '@/domain/testing/snapshot';
import { buildCheckInput, docToParagraphs, paragraphsToDoc, toCheckWiki } from './adapters';

describe('docToParagraphs', () => {
  it('returns the text of each block, in order', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'One.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Two ' }, { type: 'text', text: 'three.' }] },
      ],
    };

    expect(docToParagraphs(doc)).toEqual(['One.', 'Two three.']);
  });

  it('keeps an empty block as an empty paragraph, so indices stay aligned with the editor', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph' }, { type: 'paragraph', content: [] }] };

    expect(docToParagraphs(doc)).toEqual(['', '']);
  });

  it('skips inline nodes that are not text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] },
      ],
    };

    expect(docToParagraphs(doc)).toEqual(['ab']);
  });

  it.each([[null], [undefined], ['text'], [{ type: 'doc' }]])('returns no paragraphs for %j', (body) => {
    expect(docToParagraphs(body)).toEqual([]);
  });
});

describe('paragraphsToDoc', () => {
  it('round-trips through docToParagraphs, empty paragraphs included', () => {
    const paragraphs = ['One.', '', 'Three.'];

    expect(docToParagraphs(paragraphsToDoc(paragraphs))).toEqual(paragraphs);
  });

  it('builds an empty paragraph with no text node, which the editor requires', () => {
    expect(paragraphsToDoc([''])).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [] }] });
  });
});

describe('toCheckWiki', () => {
  it('projects each entry down to what the check engine reads', () => {
    const db = snapshot(
      snapshotEntry('maren', 'Maren Vale', { note: 'Keeper', facts: { Eyes: 'Grey' }, ties: ['light'] }),
    );

    expect(toCheckWiki(db)).toEqual({
      entries: [
        {
          id: 'maren',
          kind: 'character',
          name: 'Maren Vale',
          note: 'Keeper',
          facts: [{ id: 'maren.Eyes', entryId: 'maren', key: 'Eyes', value: 'Grey' }],
        },
      ],
    });
  });
});

describe('buildCheckInput', () => {
  it('assembles the engine input from a chapter body and a wiki snapshot', () => {
    const db = snapshot(snapshotEntry('maren', 'Maren Vale'));
    const chapterCounts = new Map([['the tallow rule', 2]]);

    const input = buildCheckInput({
      body: paragraphsToDoc(['One.']),
      db,
      resolvedMarkKeys: ['r1'],
      dismissedSuggestionKeys: ['d1'],
      chapterCounts,
    });

    expect(input).toEqual({
      paragraphs: ['One.'],
      wiki: toCheckWiki(db),
      resolvedMarkKeys: ['r1'],
      dismissedSuggestionKeys: ['d1'],
      chapterCounts,
    });
  });
});
