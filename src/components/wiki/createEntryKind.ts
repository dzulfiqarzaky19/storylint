// TCK-E01 — resolve the KIND a newly-created entry gets.
//
// An entry's `kind` IS its category id (F9-B relaxed entry.kind to a category id;
// built-in ids equal the legacy Kind strings, user categories are UUIDs). The
// wiki groups entries by `entry.kind`, so a child added under a category must be
// minted with THAT category's id — otherwise it lands in the wrong category and
// persists there on reload.
//
// Extracted from WikiScreen.createEntryOnShelf as a pure seam so the decision is
// unit-testable and mutation-provable without a running client component.

import type { Shelf } from "@/lib/domain/types";
import { KIND_FOR_SHELF } from "@/lib/domain/types";

/**
 * The `kind` a new entry created from a shelf's "+ Add" affordance should carry.
 *
 * When the add button belongs to a specific category (built-in OR user), the new
 * entry's kind is that category id, so it groups under the category it was
 * created in. When no category id is supplied (defensive fallback), it defaults
 * to the shelf's built-in kind so a plain shelf add still works.
 */
export function kindForNewEntry(shelf: Shelf, categoryId?: string): string {
  return categoryId ?? KIND_FOR_SHELF[shelf];
}
