import type { EntryWithDetails, Kind, Shelf, WikiSnapshot } from '../types';
import { KIND_SHELF } from '../types';

// Builders for the database-shaped wiki snapshot. Imported by *.test.ts files only.

export interface SnapshotEntryOptions {
  kind?: Kind;
  shelf?: Shelf;
  note?: string;
  summary?: string;
  sortOrder?: number;
  deletedAt?: number | null;
  facts?: Record<string, string>;
  /** Ids of entries this one is tied to. */
  ties?: string[];
}

export function snapshotEntry(
  id: string,
  name: string,
  options: SnapshotEntryOptions = {},
): EntryWithDetails {
  const kind = options.kind ?? 'character';
  return {
    id,
    name,
    kind,
    catalogueNo: id.toUpperCase(),
    note: options.note ?? '',
    summary: options.summary ?? '',
    shelf: options.shelf ?? KIND_SHELF[kind],
    sortOrder: options.sortOrder ?? 0,
    deletedAt: options.deletedAt ?? null,
    facts: Object.entries(options.facts ?? {}).map(([key, value], index) => ({
      id: `${id}.${key}`,
      entryId: id,
      key,
      value,
      fresh: false,
      sortOrder: index,
    })),
    ties: (options.ties ?? []).map((toEntryId) => ({
      id: `${id}>${toEntryId}`,
      fromEntryId: id,
      toEntryId,
      rel: 'knows',
      toName: toEntryId,
      toKind: 'character',
      toCatalogueNo: toEntryId.toUpperCase(),
    })),
  };
}

export function snapshot(...entries: EntryWithDetails[]): WikiSnapshot {
  return {
    entries,
    byId: Object.fromEntries(entries.map((e) => [e.id, e])),
    overrides: {},
    categories: [],
  };
}
