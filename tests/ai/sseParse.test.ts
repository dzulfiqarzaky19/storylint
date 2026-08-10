import { describe, it, expect } from "vitest";
import {
  parseSseEvents,
  textDeltaFrom,
  isStreamStop,
  type SseEvent,
} from "@/lib/ai/sseParse";

// -----------------------------------------------------------------------------
// F2b — SSE frame parsing for the streaming transport. The gateway emits
// Anthropic-compatible text/event-stream frames; the parser must (a) only ever
// surface COMPLETE frames and hold a split frame in `rest` for the next chunk,
// (b) pull the incremental text out of content_block_delta/text_delta frames,
// and (c) detect the message_stop terminal. Malformed frames are swallowed so a
// single bad line can't abort a live answer mid-stream.
// -----------------------------------------------------------------------------

/** A well-formed delta frame's data JSON (with the gateway's trailing padding). */
function deltaData(text: string): string {
  return JSON.stringify({
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text },
  });
}

describe("parseSseEvents", () => {
  it("splits complete frames on the blank line and parses event + data", () => {
    const buf =
      `event: content_block_delta\ndata: ${deltaData("Hello")}\n\n` +
      `event: message_stop\ndata: {"type":"message_stop"}\n\n`;

    const { events, rest } = parseSseEvents(buf);

    expect(events).toHaveLength(2);
    expect(events[0]?.event).toBe("content_block_delta");
    expect(textDeltaFrom(events[0] as SseEvent)).toBe("Hello");
    expect(events[1]?.event).toBe("message_stop");
    expect(rest).toBe("");
  });

  it("holds a trailing PARTIAL frame in rest until the next chunk completes it", () => {
    // A frame split mid-way across two network reads must not surface early.
    const first = `event: content_block_delta\ndata: ${deltaData("Ah")}\n\n` + `event: content_block_delta\nda`;
    const r1 = parseSseEvents(first);
    expect(r1.events).toHaveLength(1);
    expect(textDeltaFrom(r1.events[0] as SseEvent)).toBe("Ah");
    expect(r1.rest).toBe("event: content_block_delta\nda");

    // Feeding rest + the remainder yields the previously-partial frame.
    const second = r1.rest + `ta: ${deltaData("choo")}\n\n`;
    const r2 = parseSseEvents(second);
    expect(r2.events).toHaveLength(1);
    expect(textDeltaFrom(r2.events[0] as SseEvent)).toBe("choo");
    expect(r2.rest).toBe("");
  });

  it("normalizes CRLF frame delimiters", () => {
    const buf = `event: content_block_delta\r\ndata: ${deltaData("crlf")}\r\n\r\n`;
    const { events, rest } = parseSseEvents(buf);
    expect(events).toHaveLength(1);
    expect(textDeltaFrom(events[0] as SseEvent)).toBe("crlf");
    expect(rest).toBe("");
  });
});

describe("textDeltaFrom", () => {
  it("returns the text for a content_block_delta/text_delta frame", () => {
    const evt: SseEvent = { event: "content_block_delta", data: deltaData(" world") };
    expect(textDeltaFrom(evt)).toBe(" world");
  });

  it("returns null for non-delta events (message_start, ping, stop)", () => {
    expect(textDeltaFrom({ event: "ping", data: '{"type":"ping"}' })).toBeNull();
    expect(
      textDeltaFrom({ event: "message_start", data: '{"type":"message_start"}' }),
    ).toBeNull();
    expect(
      textDeltaFrom({ event: "message_stop", data: '{"type":"message_stop"}' }),
    ).toBeNull();
  });

  it("returns null (never throws) for malformed data JSON", () => {
    expect(textDeltaFrom({ event: "content_block_delta", data: "{ not json" })).toBeNull();
  });

  it("returns null for a delta whose inner type is not text_delta", () => {
    const evt: SseEvent = {
      event: "content_block_delta",
      data: JSON.stringify({ type: "content_block_delta", delta: { type: "input_json_delta" } }),
    };
    expect(textDeltaFrom(evt)).toBeNull();
  });
});

describe("isStreamStop", () => {
  it("is true for message_stop and false for a delta", () => {
    expect(isStreamStop({ event: "message_stop", data: '{"type":"message_stop"}' })).toBe(true);
    expect(
      isStreamStop({ event: "content_block_delta", data: deltaData("x") }),
    ).toBe(false);
  });

  it("detects the stop via the event NAME even when the data JSON is unparseable", () => {
    // Isolates the event-name fast-path: the data fallback would return false
    // here (malformed JSON), so only the `event === 'message_stop'` line can
    // make this true. Guards the terminal signal the persist gate depends on.
    expect(isStreamStop({ event: "message_stop", data: "{ truncated" })).toBe(true);
  });
});
