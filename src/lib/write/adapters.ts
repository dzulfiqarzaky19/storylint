/**
 * Write-screen adapters.
 *
 * Pure, framework-free glue between shapes:
 *   1. The stored chapter body (ProseMirror doc JSON) ⇄ the engine's
 *      `paragraphs: string[]` input.
 *   2. The DB's rich domain `WikiSnapshot` → the check engine's minimal
 *      `CheckWiki` (entries + facts + note only).
 *   3. `buildCheckInput`, which assembles the engine input for a chapter.
 *
 * There is deliberately NO editorial-copy overlay: the engine already projects
 * each mark's rail / noteText / actions, and re-authoring copy keyed by the four
 * known quotes would be exactly the hardcoding the product rules forbid. Marks
 * pass through verbatim.
 *
 * Kept out of the engine so `src/lib/check/` stays a pure, testable core.
 */

import type { CheckInput, CheckWiki } from '@/lib/check';
import type { WikiSnapshot as DbWiki } from '@/lib/domain/types';

// ---------------------------------------------------------------------------
// 1. ProseMirror doc ⇄ paragraphs
// ---------------------------------------------------------------------------

interface PmTextNode {
  type: string;
  text?: string;
}
interface PmBlockNode {
  type: string;
  content?: PmTextNode[];
}
interface PmDoc {
  type: string;
  content?: PmBlockNode[];
}

/**
 * Flatten a ProseMirror `doc` into one plain-text string per top-level block
 * (paragraph). The engine checks these strings; the editor owns the rich doc.
 */
export function docToParagraphs(body: unknown): string[] {
  const doc = body as PmDoc | null;
  if (!doc || !Array.isArray(doc.content)) return [];
  return doc.content.map((block) =>
    (block.content ?? [])
      .map((n) => (n.type === 'text' ? (n.text ?? '') : ''))
      .join(''),
  );
}

/** Build a paragraphs-only ProseMirror doc (seed/empty fallback). */
export function paragraphsToDoc(paragraphs: string[]): PmDoc {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: text ? [{ type: 'text', text }] : [],
    })),
  };
}

// ---------------------------------------------------------------------------
// 2. DB WikiSnapshot → CheckWiki
// ---------------------------------------------------------------------------

/**
 * Project the rich DB snapshot down to what the pure engine consumes: entries
 * with id/kind/name/note + facts (key/value). Ties, appearances, questions and
 * the `byId` index are dropped — the engine never reads them.
 */
export function toCheckWiki(db: DbWiki): CheckWiki {
  return {
    entries: db.entries.map((e) => ({
      id: e.id,
      kind: e.kind as CheckWiki['entries'][number]['kind'], // F9-B: open category-id -> fixed engine union (live entries are built-ins)
      name: e.name,
      note: e.note,
      facts: e.facts.map((f) => ({
        id: f.id,
        entryId: f.entryId,
        key: f.key,
        value: f.value,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// 3. Build the engine input for a chapter.
// ---------------------------------------------------------------------------

export function buildCheckInput(args: {
  body: unknown;
  db: DbWiki;
  resolvedMarkKeys?: string[];
  dismissedSuggestionKeys?: string[];
  chapterCounts?: ReadonlyMap<string, number>;
}): CheckInput {
  return {
    paragraphs: docToParagraphs(args.body),
    wiki: toCheckWiki(args.db),
    resolvedMarkKeys: args.resolvedMarkKeys,
    dismissedSuggestionKeys: args.dismissedSuggestionKeys,
    chapterCounts: args.chapterCounts,
  };
}
