/**
 * Small text utilities for the check passes. Pure and dependency-free.
 */

/**
 * Split a paragraph into sentences. Deliberately simple: split on sentence-final
 * punctuation (. ! ?) followed by whitespace. The manuscript has no abbreviations
 * mid-sentence, so a naive split is correct here; keeping it simple avoids
 * over-fitting the engine to one chapter.
 */
export function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * The occurrence index of `quote` within `paragraph`: how many identical
 * substrings precede the first match. For the manuscript each quote is unique,
 * so this is 0, but the engine must compute it rather than assume it (HANDOFF §7
 * "recomputed on every check").
 */
export function occurrenceIndexOf(paragraph: string, quote: string): number {
  const at = paragraph.indexOf(quote);
  if (at <= 0) return 0;
  // Count non-overlapping earlier occurrences.
  let count = 0;
  let from = 0;
  while (true) {
    const next = paragraph.indexOf(quote, from);
    if (next === -1 || next >= at) break;
    count += 1;
    from = next + quote.length;
  }
  return count;
}

/** Tokenize a phrase into lowercased word tokens (letters, digits, apostrophes, hyphens). */
export function words(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9'’-]*/g);
  return matches ?? [];
}
