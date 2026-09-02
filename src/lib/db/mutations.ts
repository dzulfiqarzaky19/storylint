// Parameterized write helpers (INSERT/UPDATE) for the mutation paths in
// src/lib/actions/*. Companion to the read-only queries.ts (owned by calf);
// kept in a separate file to avoid concurrent-edit collisions on the shared
// query layer. Same rules as queries.ts:
//
//   * ALWAYS use $1/$2/... placeholders. NEVER interpolate values into SQL.
//   * Column names are snake_case in the DB; result aliases map to camelCase.
//
// These are minimal, clearly-named helpers. They do not enforce product rules;
// the confirmation invariant (product rule 1) lives at the action layer.


// Structural universe/world/book renames + creation + delete-cascades were
// split into structure-mutations.ts (T-ARCH-16); re-exported here so the
// "@/lib/db/mutations" barrel path is unchanged for every caller.
export {
  renameWorld,
  renameUniverse,
  renameBook,
  insertUniverse,
  insertBook,
  insertBookWithFirstChapter,
  createFreshUniverse,
  insertWorld,
  deleteUniverseCascade,
  deleteBookCascade,
  deleteWorldCascade,
} from "./structure-mutations";
export type { UniverseRow, BookRow, WorldRow, CascadeCount } from "./structure-mutations";

// ---- Gazetteer (T-ARCH-2 shim; SQL lives in gazetteer-mutations.ts) ----
export {
  insertFact,
  updateFactEntry,
  clearFactFresh,
  updateEntryShelfOrder,
  insertEntry,
  insertEntryLinkedToWorld,
  softDeleteEntry,
  restoreEntry,
  purgeDeletedBefore,
  reorderShelf,
  insertTie,
  deleteTie,
  deleteFact,
  createEntryWithTie,
  getMaxSortOrderForShelf,
  getMaxSortOrderForFacts,
  getMaxCategorySortOrder,
  createCategory,
  renameCategory,
  resetCategoryLabel,
  deleteCategory,
  updateEntryFields,
  updateFact,
  linkEntityToWorld,
  unlinkEntityFromWorld,
  upsertEntryFacet,
} from "./gazetteer-mutations";
export type { EntryFacetRow } from "./gazetteer-mutations";

// ---- Chapters (manuscript) (T-ARCH-2 shim; SQL lives in chapter-mutations.ts) ----
export {
  saveChapterBody,
  replacePhraseMentions,
  getNextChapterNumber,
  insertChapter,
  renameChapter,
  countChaptersInBook,
  deleteChapter,
  upsertResolvedMark,
} from "./chapter-mutations";

// ---- Kept cards (Research) (T-ARCH-2 shim; SQL lives in research-mutations.ts) ----
export {
  upsertKeptCard,
  deleteKeptCard,
  markKeptInWiki,
} from "./research-mutations";

// ---- Dismissed suggestions (T-ARCH-2 shim; SQL lives in chapter-mutations.ts) ----
export { insertDismissedSuggestion } from "./chapter-mutations";

// ---- Reads used by mutation paths -----------------------------------------
// These are SELECTs, but they live here (not queries.ts) because they exist
// solely to support the write paths above (e.g. confirmCard needs the source
// proposition and the next free sortOrder). Keeping them beside their callers
// avoids concurrent edits to the shared read layer.

export { getProposition } from "./research-mutations";


// ---- Research threads/turns (T-ARCH-2 shim; SQL lives in research-mutations.ts) ----
export {
  getNextResearchThreadSortOrder,
  insertResearchThread,
  insertResearchTurnPair,
  deleteThread,
  deleteLastThreadGuarded,
  updateThreadTitle,
} from "./research-mutations";
export type {
  ResearchCardInput,
  ResearchTurnPairInput,
  PersistedTurnRef,
} from "./research-mutations";


// ---- Chapter AI-check cache (T-AICACHE) -----------------------------------

// ---- Chapter AI-check cache (T-ARCH-2 shim; SQL lives in chapter-mutations.ts) ----
export { upsertChapterCheckCache } from "./chapter-mutations";
