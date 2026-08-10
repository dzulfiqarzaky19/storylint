// =============================================================================
// Server-Sent Events (SSE) frame parsing for the SaaRouters streaming transport.
//
// SaaRouters is Anthropic Messages-API compatible. With `stream: true` it emits
// text/event-stream frames shaped as:
//
//   event: content_block_delta
//   data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}
//   <blank line>
//
// The gateway pads its `data:` JSON with trailing spaces before `}` (a harmless
// quirk JSON.parse tolerates) and interleaves message_start / ping /
// content_block_start / content_block_stop / message_delta / message_stop.
//
// This module is PURE (no fetch, no server-only): it turns a raw text buffer into
// the completed events plus the unparsed tail, so streamComplete() can feed it
// network chunks that split frames at arbitrary byte boundaries. Kept separate so
// the parse logic is unit-testable without the server-only transport shim.
// =============================================================================

/** A single decoded SSE frame: its `event:` name (if any) and raw `data:` text. */
export interface SseEvent {
  event: string | null;
  data: string;
}

/**
 * Split a raw SSE text buffer into COMPLETE frames plus the leftover tail.
 *
 * Frames are separated by a blank line (`\n\n`). Only whole frames (those
 * terminated by a blank line already present in the buffer) are returned; a
 * trailing partial frame stays in `rest` for the next chunk to complete. This is
 * what makes streamComplete robust to a frame split across two network reads.
 */
export function parseSseEvents(buffer: string): { events: SseEvent[]; rest: string } {
  // Normalize CRLF so the frame delimiter is always "\n\n".
  const normalized = buffer.replace(/\r\n/g, "\n");
  const events: SseEvent[] = [];
  let searchFrom = 0;
  let sep = normalized.indexOf("\n\n", searchFrom);
  while (sep !== -1) {
    const frame = normalized.slice(searchFrom, sep);
    const parsed = parseFrame(frame);
    if (parsed) events.push(parsed);
    searchFrom = sep + 2;
    sep = normalized.indexOf("\n\n", searchFrom);
  }
  return { events, rest: normalized.slice(searchFrom) };
}

/** Parse one frame's lines into an SseEvent, or null if it carries no data. */
function parseFrame(frame: string): SseEvent | null {
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      // Per the SSE spec a single leading space after the colon is stripped;
      // multiple data lines join with "\n".
      dataLines.push(line.slice("data:".length).replace(/^ /, ""));
    }
    // Blank lines and comment lines (":...") are ignored.
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

/** The event names that carry a streamed text delta vs. terminate the stream. */
interface DeltaEvent {
  type: string;
  delta?: { type?: string; text?: string };
}

/**
 * Extract the incremental text from a content_block_delta event's data, or null
 * for any other event (message_start, ping, message_stop, ...). Never throws:
 * malformed JSON yields null so a single bad frame can't abort the stream.
 */
export function textDeltaFrom(evt: SseEvent): string | null {
  let parsed: DeltaEvent;
  try {
    parsed = JSON.parse(evt.data) as DeltaEvent;
  } catch {
    return null;
  }
  if (parsed.type !== "content_block_delta") return null;
  if (parsed.delta?.type !== "text_delta") return null;
  return typeof parsed.delta.text === "string" ? parsed.delta.text : null;
}

/** True when this event is the stream's terminal marker (`message_stop`). */
export function isStreamStop(evt: SseEvent): boolean {
  if (evt.event === "message_stop") return true;
  try {
    return (JSON.parse(evt.data) as DeltaEvent).type === "message_stop";
  } catch {
    return false;
  }
}
