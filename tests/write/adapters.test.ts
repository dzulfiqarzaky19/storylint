/**
 * Write-screen adapter seam (HANDOFF §6/§7/§8).
 *
 * The Write screen runs the SAME pure engine in two places:
 *   - server load (`app/write/page.tsx`): `buildCheckInput({ body, db, ... })`
 *   - client re-check (`Manuscript.tsx` onUpdate, ~300ms): the adapters called
 *     separately — `docToParagraphs(editor.getJSON())` + `toCheckWiki(db)` — then
 *     `checkManuscript({ paragraphs, wiki, resolvedMarkKeys })`.
 *
 * If those two entry points ever diverge, the live UI would paint marks that the
 * server never saw (or vice-versa). These tests LOCK the seam so a drift fails
 * here instead of only in the browser (which needs a manual bridge approval to
 * observe). No DB: a minimal in-file DB-shape wiki stands in for the seeded row.
 */

import { describe, it, expect } from 'vitest';
import { checkManuscript } from '@/lib/check';
import type { Mark } from '@/lib/check';
import {
  buildCheckInput,
  docToParagraphs,
  paragraphsToDoc,
  toCheckWiki,
} from '@/lib/write/adapters';
import type {
  WikiSnapshot as DbWiki,
  EntryWithDetails,
  FactRow,
} from '@/lib/domain/types';

// --- Minimal DB-shape wiki (only the fields the engine reads carry signal) ---
function fact(id: string, entryId: string, key: string, value: string): FactRow {
  return { id, entryId, key, value, fresh: false, sortOrder: 0 };
}
function entry(over: Partial<EntryWithDetails> & { id: string; name: string }): EntryWithDetails {
  return {
    id: over.id,
    kind: over.kind ?? 'character',
    name: over.name,
    catalogueNo: over.catalogueNo ?? 'C-000',
    note: over.note ?? '',
    summary: over.summary ?? '',
    shelf: over.shelf ?? 'people',
    sortOrder: over.sortOrder ?? 0,
    deletedAt: over.deletedAt ?? null,
    facts: over.facts ?? [],
    ties: over.ties ?? [],
    appearances: over.appearances ?? [],
    openQuestions: over.openQuestions ?? [],
  };
}

const maren = entry({
  id: 'e-maren',
  name: 'Maren Vell',
  note: 'A lantern-keeper of Ashkeld.',
  facts: [fact('f-eyes', 'e-maren', 'Eyes', 'green')],
});
const dbWiki: DbWiki = {
  entries: [maren],
  byId: { 'e-maren': maren },
};

// A manuscript that contradicts the wiki (grey vs green eyes) → a conflict mark.
const paragraphs = [
  'The dock smelled of tar and cold iron.',
  'Her own grey eyes caught the lantern first, before the others looked up.',
];

function keys(ms: Mark[]): string[] {
  return ms.map((m) => m.markKey).sort();
}

describe('Write adapter seam — doc ⇄ paragraphs', () => {
  it('docToParagraphs ∘ paragraphsToDoc is the identity on paragraph text', () => {
    expect(docToParagraphs(paragraphsToDoc(paragraphs))).toEqual(paragraphs);
  });

  it('an empty paragraph round-trips to an empty string (no stray text node)', () => {
    const withEmpty = ['first', '', 'third'];
    expect(docToParagraphs(paragraphsToDoc(withEmpty))).toEqual(withEmpty);
  });

  it('a non-doc / malformed body flattens to [] rather than throwing', () => {
    expect(docToParagraphs(null)).toEqual([]);
    expect(docToParagraphs({ type: 'doc' })).toEqual([]);
    expect(docToParagraphs(42 as unknown)).toEqual([]);
  });
});

describe('Write adapter seam — toCheckWiki projection', () => {
  it('keeps id/kind/name/note + facts(id,entryId,key,value); drops byId/ties/etc', () => {
    const projected = toCheckWiki(dbWiki);
    expect(projected.entries).toHaveLength(1);
    const e = projected.entries[0];
    expect(e).toEqual({
      id: 'e-maren',
      kind: 'character',
      name: 'Maren Vell',
      note: 'A lantern-keeper of Ashkeld.',
      facts: [{ id: 'f-eyes', entryId: 'e-maren', key: 'Eyes', value: 'green' }],
    });
    // The rich DB fields the engine never reads must not leak through.
    const bag = e as unknown as Record<string, unknown>;
    expect(bag.byId).toBeUndefined();
    expect(bag.ties).toBeUndefined();
    expect(bag.summary).toBeUndefined();
  });
});

describe('Write adapter seam — server load == client re-check', () => {
  it('buildCheckInput(body,db) yields the same paragraphs+wiki as the separate adapter calls', () => {
    const body = paragraphsToDoc(paragraphs);
    const built = buildCheckInput({ body, db: dbWiki, resolvedMarkKeys: [] });
    expect(built.paragraphs).toEqual(docToParagraphs(body));
    expect(built.wiki).toEqual(toCheckWiki(dbWiki));
  });

  it('both paths produce identical marks (same keys + field-for-field projection)', () => {
    const body = paragraphsToDoc(paragraphs);
    // Server-load path.
    const server = checkManuscript(
      buildCheckInput({ body, db: dbWiki, resolvedMarkKeys: [] }),
    ).marks;
    // Client re-check path (adapters called separately, as Manuscript.tsx does).
    const client = checkManuscript({
      paragraphs: docToParagraphs(body),
      wiki: toCheckWiki(dbWiki),
      resolvedMarkKeys: [],
    }).marks;

    expect(server.length).toBeGreaterThan(0);
    expect(keys(client)).toEqual(keys(server));
    expect(client).toEqual(server); // full structural equality of every mark
  });
});

describe('Write adapter seam — live reactivity + key stability', () => {
  it('editing away the conflicting quote drops that mark', () => {
    const before = checkManuscript(
      buildCheckInput({ body: paragraphsToDoc(paragraphs), db: dbWiki }),
    ).marks;
    const conflict = before.find((m) => m.kind === 'conflict');
    expect(conflict, 'a conflict mark exists to fix').toBeDefined();

    const fixed = paragraphs.map((p) => p.replace('grey', 'green'));
    const after = checkManuscript(
      buildCheckInput({ body: paragraphsToDoc(fixed), db: dbWiki }),
    ).marks;

    expect(after.some((m) => m.markKey === conflict!.markKey)).toBe(false);
    expect(after.length).toBeLessThan(before.length);
  });

  it('a mark keeps its markKey when its paragraph moves (position-independent key)', () => {
    const original = checkManuscript(
      buildCheckInput({ body: paragraphsToDoc(paragraphs), db: dbWiki }),
    ).marks;
    // Move the offending paragraph to the front; same text, new paragraphIndex.
    const reordered: string[] = [paragraphs[1]!, paragraphs[0]!];
    const moved = checkManuscript(
      buildCheckInput({ body: paragraphsToDoc(reordered), db: dbWiki }),
    ).marks;

    expect(keys(moved)).toEqual(keys(original));
    // The paragraph index actually changed, proving the key is not position-based.
    const o = original.find((m) => m.kind === 'conflict')!;
    const m = moved.find((m) => m.kind === 'conflict')!;
    expect(m.markKey).toBe(o.markKey);
    expect(m.position.paragraphIndex).not.toBe(o.position.paragraphIndex);
  });
});
