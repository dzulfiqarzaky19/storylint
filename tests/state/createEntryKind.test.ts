// TCK-E01 — a new entry's category IS its kind.
//
// BUG (flamingo F-B2): createEntryOnShelf minted kind = KIND_FOR_SHELF[shelf],
// a BUILT-IN kind, ignoring the category the "+ Add" button belonged to. A user
// category defaults to shelf 'lore', so every child added under it got
// kind='lore' and grouped under the built-in Lore category (byCategory keys on
// entry.kind), never under the user category — and it persisted there on reload.
//
// The reducer + server action persist whatever `kind` they are handed faithfully
// (locked elsewhere), so the ONLY wrong value was the one createEntryOnShelf
// computed. That decision is extracted here as the pure `kindForNewEntry` seam so
// it is unit-testable and mutation-provable without a running client component.
//
// Mutation-locked line: `kindForNewEntry` returns `categoryId ?? KIND_FOR_SHELF[shelf]`.
//  * Drop the `categoryId ??` (revert to `KIND_FOR_SHELF[shelf]`) and the
//    user-category assertion goes RED: the child would be minted as built-in
//    'lore' instead of the user category's id.

import { describe, it, expect } from "vitest";
import { kindForNewEntry } from "@/components/wiki/createEntryKind";
import { KIND_FOR_SHELF } from "@/lib/domain/types";

describe("kindForNewEntry — the new entry's category IS its kind (TCK-E01)", () => {
  it("returns the USER category id verbatim, so the child groups under THAT category, not built-in lore", () => {
    // A user category living on the 'lore' shelf (the default for new categories).
    const userCategoryId = "b1f2c3d4-e5f6-4a7b-8c9d-0123456789ab";
    expect(kindForNewEntry("lore", userCategoryId)).toBe(userCategoryId);
    // The bug returned the built-in 'lore' kind; assert we are NOT doing that.
    expect(kindForNewEntry("lore", userCategoryId)).not.toBe(KIND_FOR_SHELF.lore);
  });

  it("falls back to the built-in kind for the shelf when no categoryId is given (built-in add still works)", () => {
    // Guard: a built-in shelf add with no explicit user category must still mint
    // the legacy built-in kind so existing behavior is unchanged.
    expect(kindForNewEntry("people")).toBe(KIND_FOR_SHELF.people); // 'character'
    expect(kindForNewEntry("places")).toBe(KIND_FOR_SHELF.places); // 'world'
    expect(kindForNewEntry("orders")).toBe(KIND_FOR_SHELF.orders); // 'organization'
    expect(kindForNewEntry("lore")).toBe(KIND_FOR_SHELF.lore); // 'lore'
  });

  it("a built-in category id passed explicitly is returned unchanged (== legacy kind, no behavior change)", () => {
    // Built-in category ids equal the legacy Kind strings, so threading the id
    // through for a built-in shelf yields exactly the same kind as before.
    expect(kindForNewEntry("people", "character")).toBe("character");
    expect(kindForNewEntry("lore", "lore")).toBe("lore");
  });
});
