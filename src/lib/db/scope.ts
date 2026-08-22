// Default active scope. Until the UI exposes a universe/world/book picker, every
// read defaults to the seeded default book (see DEFAULT_BOOK_SLUG). These ids are
// DERIVED from that slug the exact same way loadBook.ts mints them, so the runtime
// default and the seed can never drift apart. loadBook namespaces every id by slug:
// `universe-<slug>`, `world-<slug>`, `<slug>-1` (the first book).
import { DEFAULT_BOOK_SLUG } from "../novel/bookSlug";

export const DEFAULT_UNIVERSE_ID = `universe-${DEFAULT_BOOK_SLUG}`;
export const DEFAULT_WORLD_ID = `world-${DEFAULT_BOOK_SLUG}`;
// W-6: books belong DIRECTLY to a world (series was merged away). This is the
// default parent world for a new book, and the exact book id loadBook mints first.
export const DEFAULT_BOOK_ID = `${DEFAULT_BOOK_SLUG}-1`;
