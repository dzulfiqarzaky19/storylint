// F2b — hardened parse of the streamed research answer (Option C).
//
// Streaming can't carry the blocking path's strict-JSON `{reply, cards}` shape
// as-is: streaming raw JSON tokens would show the writer braces and quotes. So
// the model streams PROSE first, then a sentinel line, then STRICT JSON of the
// cards. This module splits the FULL assembled buffer at COMPLETION (never
// mid-stream) into the prose reply and the parsed cards.
//
// Hardening (chick's gate): degrade to no-cards-but-keep-the-reply, never crash.
//   - split on the LAST sentinel, so a sentinel echoed inside the prose can't
//     steal the split;
//   - strict-JSON-or-empty: absent/invalid/non-array JSON => cards: [] while the
//     reply is preserved (mirrors the blocking path's try/catch fallback);
//   - a trailing PARTIAL sentinel (stream cut mid-token) is trimmed off the reply
//     so no delimiter fragment leaks to the writer.
//
// The route handler streams prose to the client only up to the sentinel; this
// parse is the completion-time reconciliation that also feeds the persist txn.

/** Delimiter between the streamed prose reply and the trailing cards JSON. */
export const CARDS_SENTINEL = "\n\u2063---CARDS---\u2063\n";

/** One parsed card, shaped exactly like the blocking path's AiProposition. */
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

/** The sentinel with surrounding whitespace stripped, for partial-tail matching. */
const SENTINEL_CORE = CARDS_SENTINEL.trim();

/**
 * Split an assembled streamed answer into its prose reply and its cards.
 *
 * Never throws: any parse failure yields the reply with an empty cards list.
 */
export function splitStreamedAnswer(buffer: string): SplitAnswer {
  const idx = buffer.lastIndexOf(CARDS_SENTINEL);
  if (idx === -1) {
    // No sentinel: the whole buffer is prose (mirrors the blocking path's
    // reply.trim()); strip any dangling partial sentinel first.
    return { reply: stripPartialSentinel(buffer).trim(), cards: [] };
  }
  const reply = buffer.slice(0, idx).trim();
  const jsonPart = buffer.slice(idx + CARDS_SENTINEL.length);
  return { reply, cards: parseCards(jsonPart) };
}

/**
 * Parse the post-sentinel text as a strict JSON array of cards. Any failure
 * (non-JSON, valid-but-not-an-array) returns []. Entries with neither a title
 * nor a body are dropped, and the list is capped at 3 (mirrors the blocking
 * path's normalize step so streamed and non-streamed answers agree).
 */
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

/**
 * When the stream is cut after emitting only a PREFIX of the sentinel, trim that
 * dangling fragment so no delimiter characters reach the writer. Matches the
 * longest suffix of the buffer that is a non-empty prefix of the sentinel core.
 */
function stripPartialSentinel(buffer: string): string {
  for (let len = SENTINEL_CORE.length; len > 0; len--) {
    const prefix = SENTINEL_CORE.slice(0, len);
    // The tail may carry the sentinel's leading whitespace too, so test a
    // trimmed-right view of the buffer against each sentinel-core prefix.
    const trimmedRight = buffer.replace(/\s+$/, "");
    if (trimmedRight.endsWith(prefix)) {
      return trimmedRight.slice(0, trimmedRight.length - prefix.length).replace(/\s+$/, "");
    }
  }
  return buffer;
}

/**
 * The portion of the running buffer that is SAFE to show the writer mid-stream.
 *
 * The route forwards prose token-by-token but must never leak the sentinel or
 * the trailing cards JSON. Given the buffer assembled so far, this returns:
 *   - everything BEFORE the first sentinel, once the FULL sentinel has arrived
 *     (the cards JSON after it is never visible); OR
 *   - the buffer minus any trailing PARTIAL sentinel prefix, so a sentinel that
 *     is still arriving one token at a time is held back until it either
 *     completes (then we cut at it) or turns out to be ordinary prose.
 *
 * The route diffs this against the length it has already forwarded to derive the
 * next chunk to emit. Monotonic: because a partial tail is only ever held back,
 * the visible prefix never shrinks as more text arrives.
 *
 * NOTE: unlike the completion-time reply, this does NOT .trim() — trimming a
 * growing buffer would retroactively drop interior whitespace already shown.
 */
export function visibleProsePrefix(buffer: string): string {
  const idx = buffer.indexOf(CARDS_SENTINEL);
  if (idx !== -1) {
    // Full sentinel present: prose is everything before it; JSON stays hidden.
    return buffer.slice(0, idx);
  }
  // No full sentinel yet: hold back any dangling partial-sentinel tail.
  return stripPartialSentinel(buffer);
}
