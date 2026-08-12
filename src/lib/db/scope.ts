// F7 default active scope. Until the UI exposes a universe/world/book picker,
// every read defaults to the single seeded Ashkeld hierarchy so existing callers
// and the live DB behave exactly as before S2. These mirror the ids seeded by
// seed.ts and stamped by the expand migrations (universe-1 / world-universe-1 /
// book-1); they are the runtime source of truth so nothing imports from a
// migration module.
export const DEFAULT_UNIVERSE_ID = "universe-1";
export const DEFAULT_BOOK_ID = "book-1";
// W-6: books now belong DIRECTLY to a world (series was merged away). This is the
// default parent world for a new book (took over DEFAULT_SERIES_ID's role in
// insertBook). It is the W-1 backfill id `world-${universe}` for the default
// universe, i.e. 'world-universe-1' — the same world seed.ts mints for book-1.
export const DEFAULT_WORLD_ID = `world-${DEFAULT_UNIVERSE_ID}`;
