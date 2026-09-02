// Barrel: preserves the "./gazetteer" import path after the read layer was
// split into row reads (reads.ts) + composed snapshot reads (snapshots.ts)
// (T-ARCH-17). No caller import changed. Column fragments stay internal.
export {
  getAllEntries,
  getWorldEntries,
  getEntry,
  getDeletedEntries,
  getFactsForEntry,
  getAppearancesForEntry,
  getOpenQuestionsForEntry,
  getTiesForEntry,
  getCategories,
} from "./reads";
export {
  loadWikiSnapshot,
  loadWorldSnapshot,
  getEntryWithDetails,
} from "./snapshots";
