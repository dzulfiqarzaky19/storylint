import { deepFreeze } from '@/domain/testing/freeze';
import { snapshot } from '@/domain/testing/snapshot';
import type { CategoryRow, EntryWithDetails, WikiSuggestion } from '@/domain/types';
import { initWikiState } from '../entries';
import type { WikiState } from '../types';

// Builders for wiki reducer tests. Imported by *.test.ts files only.

/** A frozen state holding the given entries: any mutation by a reducer throws. */
export function stateOf(
  entries: EntryWithDetails[],
  extra: Partial<Pick<WikiState, 'suggestions' | 'categories' | 'overrides' | 'selectedEntryId'>> = {},
): WikiState {
  return deepFreeze({ ...initWikiState(snapshot(...entries)), ...extra });
}

export function category(id: string, label: string, over: Partial<CategoryRow> = {}): CategoryRow {
  return { id, label, shelf: 'lore', sortOrder: 0, isBuiltin: false, deletedAt: null, ...over };
}

export function suggestion(suggestionKey: string, entryId: string): WikiSuggestion {
  return {
    suggestionKey,
    entryId,
    key: 'Carries',
    value: 'A brass ring',
    text: '“a brass ring” — not yet in the wiki',
    source: 'Chapter 1',
  };
}
