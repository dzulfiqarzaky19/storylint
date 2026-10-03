import type { CheckWiki, EntryKind, Mark, WikiEntry } from '../index';

// Builders for check-engine tests. Imported by *.test.ts files only.

export interface EntryOptions {
  kind?: EntryKind;
  aliases?: string[];
  note?: string;
  facts?: Record<string, string>;
}

export function entry(id: string, name: string, options: EntryOptions = {}): WikiEntry {
  return {
    id,
    name,
    kind: options.kind ?? 'character',
    aliases: options.aliases,
    note: options.note,
    facts: Object.entries(options.facts ?? {}).map(([key, value]) => ({
      id: `${id}.${key}`,
      entryId: id,
      key,
      value,
    })),
  };
}

export function wiki(...entries: WikiEntry[]): CheckWiki {
  return { entries };
}

export function mark(over: Partial<Mark> = {}): Mark {
  return {
    markKey: 'mark-1',
    kind: 'missing',
    ruleId: 'unrecorded',
    quote: 'a quote',
    rail: 'rail',
    noteText: 'note',
    actions: [],
    position: { paragraphIndex: 0, occurrenceIndex: 0 },
    ...over,
  };
}
