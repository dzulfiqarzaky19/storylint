export const CARDS_SENTINEL = "\n\u2063---CARDS---\u2063\n";

export interface ParsedCard {
  kind?: string;
  title?: string;
  body?: string;
  asKind?: string;
  forEntry?: string;
}

export interface SplitAnswer {
  reply: string;
  cards: ParsedCard[];
}

const SENTINEL_CORE = CARDS_SENTINEL.trim();

export function splitStreamedAnswer(buffer: string): SplitAnswer {
  const idx = buffer.lastIndexOf(CARDS_SENTINEL);
  if (idx === -1) {
    return { reply: stripPartialSentinel(buffer).trim(), cards: [] };
  }
  const reply = buffer.slice(0, idx).trim();
  const jsonPart = buffer.slice(idx + CARDS_SENTINEL.length);
  return { reply, cards: parseCards(jsonPart) };
}

function parseCards(jsonPart: string): ParsedCard[] {
  const cleaned = jsonPart
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  if (!cleaned) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((c): c is ParsedCard => typeof c === "object" && c !== null)
    .filter((c) => Boolean(c.title) || Boolean(c.body))
    .slice(0, 3);
}

function stripPartialSentinel(buffer: string): string {
  for (let len = SENTINEL_CORE.length; len > 0; len--) {
    const prefix = SENTINEL_CORE.slice(0, len);
    const trimmedRight = buffer.replace(/\s+$/, "");
    if (trimmedRight.endsWith(prefix)) {
      return trimmedRight.slice(0, trimmedRight.length - prefix.length).replace(/\s+$/, "");
    }
  }
  return buffer;
}

export function visibleProsePrefix(buffer: string): string {
  const idx = buffer.indexOf(CARDS_SENTINEL);
  if (idx !== -1) {
    return buffer.slice(0, idx);
  }
  return stripPartialSentinel(buffer);
}
