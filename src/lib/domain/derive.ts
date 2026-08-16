// Derived display strings.

/** `${chapterCount} chapters · ${flaggedCount} to settle`, or "no chapters yet". */
export function appearLine(chapterCount: number, flaggedCount: number): string {
  if (chapterCount === 0) return "no chapters yet";
  return `${chapterCount} chapters · ${flaggedCount} to settle`;
}

/** `${entryCount} entries · drag a tile anywhere it belongs`. */
export function worldLine(entryCount: number): string {
  return `${entryCount} entries · drag a tile anywhere it belongs`;
}

/**
 * Poster-band headline. The band now derives across the whole active book (not a
 * single hardcoded chapter), so the headline drops the old "Chapter 7" prefix and
 * counts across the book: `${n} things the gazetteer has never written down.`
 */
export function sugHeadline(n: number): string {
  return `${n} things the gazetteer has never written down.`;
}
