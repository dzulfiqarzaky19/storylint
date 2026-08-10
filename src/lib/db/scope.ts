// F7 default active scope. Until the UI exposes a universe/series/book picker,
// every read defaults to the single seeded Ashkeld hierarchy so existing callers
// and the live DB behave exactly as before S2. These mirror the ids seeded by
// seed.ts and stamped by the f7a expand migration (universe-1 / series-1 /
// book-1); they are the runtime source of truth so nothing imports from a
// migration module.
export const DEFAULT_UNIVERSE_ID = "universe-1";
export const DEFAULT_SERIES_ID = "series-1";
export const DEFAULT_BOOK_ID = "book-1";
