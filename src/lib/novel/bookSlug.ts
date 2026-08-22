// The default book that seeds and every runtime scope default derive from. This
// is a LEAF constant module with NO `node:` imports on purpose: `db/scope.ts`
// (imported transitively by the client ScopePill via wiki/scope.ts) needs only
// this string, and must not drag `loadBook.ts`'s `node:fs`/`node:path` into the
// browser bundle. loadBook.ts re-exports this so its own consumers are unchanged.
export const DEFAULT_BOOK_SLUG = "mother-of-learning";
