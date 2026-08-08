// Derived display strings (HANDOFF §6 "Derived strings" — compute, never hardcode).

/** `${chapterCount} chapters · ${flaggedCount} to settle`, or "no chapters yet". */
export function appearLine(chapterCount: number, flaggedCount: number): string {
  if (chapterCount === 0) return "no chapters yet";
  return `${chapterCount} chapters · ${flaggedCount} to settle`;
}

/** `${entryCount} entries · drag a tile anywhere it belongs`. */
export function worldLine(entryCount: number): string {
  return `${entryCount} entries · drag a tile anywhere it belongs`;
}

/** `Chapter 7 mentioned ${n} things the gazetteer has never written down.` */
export function sugHeadline(n: number): string {
  return `Chapter 7 mentioned ${n} things the gazetteer has never written down.`;
}
