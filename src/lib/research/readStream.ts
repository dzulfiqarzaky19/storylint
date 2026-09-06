// F2b — client-side reader for the /api/research/stream NDJSON response.
//
// The route emits one JSON object per line (newline-delimited): `delta` frames
// carrying prose, then exactly one `done` (with the persisted turns) or an
// `error`. This reader owns the transport-level concerns so Research only
// deals with typed callbacks:
//   - decode incrementally and split on "\n" (a frame may span network chunks,
//     so a trailing partial line is held until its newline arrives);
//   - JSON.parse each COMPLETE line and dispatch by `type`;
//   - a blank line or an unparseable line is skipped (never throws mid-read).
//
// It is pure over an injected reader, so it is unit-testable with a fake stream
// (no fetch, no route). Research passes `response.body.getReader()`.

import type { ResearchTurnWithCards } from "../domain/types";

/** A `delta` frame: a chunk of visible prose to append to the placeholder. */
export interface DeltaFrame {
  type: "delta";
  text: string;
}
/** A `done` frame: the two server-persisted turns for RECONCILE_TURN. */
export interface DoneFrame {
  type: "done";
  turns: ResearchTurnWithCards[];
}
/** An `error` frame: a human-readable failure message. */
export interface ErrorFrame {
  type: "error";
  error: string;
}

export type StreamFrame = DeltaFrame | DoneFrame | ErrorFrame;

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onDone: (turns: ResearchTurnWithCards[]) => void;
  onError: (message: string) => void;
}

/** A minimal reader shape (matches ReadableStreamDefaultReader<Uint8Array>). */
export interface ByteReader {
  read: () => Promise<{ done: boolean; value?: Uint8Array }>;
}

/**
 * Drain the NDJSON stream, dispatching each complete frame to its handler.
 *
 * Resolves when the stream ends. Never throws for a malformed line; a JSON parse
 * failure on one line is skipped so a single bad frame cannot abort the read.
 */
export async function readResearchStream(
  reader: ByteReader,
  handlers: StreamHandlers,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatchLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return; // blank keep-alive line
    let frame: StreamFrame;
    try {
      frame = JSON.parse(trimmed) as StreamFrame;
    } catch {
      return; // skip an unparseable line rather than aborting the whole read
    }
    if (frame.type === "delta") {
      handlers.onDelta(frame.text);
    } else if (frame.type === "done") {
      handlers.onDone(frame.turns);
    } else if (frame.type === "error") {
      handlers.onError(frame.error);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      // Emit every COMPLETE line; the tail after the last "\n" is a partial
      // frame held for the next chunk.
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        dispatchLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
      }
    }
    if (done) break;
  }

  // Flush any final line that arrived without a trailing newline.
  if (buffer) dispatchLine(buffer);
}
