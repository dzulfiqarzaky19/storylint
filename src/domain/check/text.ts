export function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Which occurrence of `quote` the one at offset `at` is: the count of
// non-overlapping occurrences that start before it. resolveMarkRange walks the
// same way to turn the index back into a range.
export function occurrenceIndexOf(paragraph: string, quote: string, at: number): number {
  if (quote.length === 0) return 0;
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

export function words(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9'’-]*/g);
  return matches ?? [];
}
