import type { CheckInput, CheckWiki } from '@/domain/check';
import type { WikiSnapshot as DbWiki } from '@/domain/types';

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

export function docToParagraphs(body: unknown): string[] {
  const doc = body as PmDoc | null;
  if (!doc || !Array.isArray(doc.content)) return [];
  return doc.content.map((block) =>
    (block.content ?? [])
      .map((n) => (n.type === 'text' ? (n.text ?? '') : ''))
      .join(''),
  );
}

export function paragraphsToDoc(paragraphs: string[]): PmDoc {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: text ? [{ type: 'text', text }] : [],
    })),
  };
}

export function toCheckWiki(db: DbWiki): CheckWiki {
  return {
    entries: db.entries.map((e) => ({
      id: e.id,
      kind: e.kind as CheckWiki['entries'][number]['kind'],
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
