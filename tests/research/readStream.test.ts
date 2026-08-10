import { describe, it, expect, vi } from "vitest";
import { readResearchStream, type ByteReader } from "@/lib/research/readStream";

// -----------------------------------------------------------------------------
// F2b — client NDJSON reader. Proven with a FAKE ByteReader (no fetch/route):
// the properties are frame framing (split across network chunks), dispatch by
// type, and never-throw-on-garbage. ResearchScreen wires these callbacks to
// STREAM_DELTA / RECONCILE_TURN / SET_ERROR.
// -----------------------------------------------------------------------------

const enc = new TextEncoder();

/** A fake reader that yields the given byte chunks in order, then done. */
function fakeReader(chunks: Uint8Array[]): ByteReader {
  let i = 0;
  return {
    read: async () => {
      if (i < chunks.length) return { done: false, value: chunks[i++] };
      return { done: true, value: undefined };
    },
  };
}

function handlers() {
  return {
    onDelta: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };
}

describe("readResearchStream", () => {
  it("dispatches delta frames in order then done", async () => {
    const h = handlers();
    const lines =
      JSON.stringify({ type: "delta", text: "Hello " }) +
      "\n" +
      JSON.stringify({ type: "delta", text: "world." }) +
      "\n" +
      JSON.stringify({ type: "done", turns: [{ id: "t1" }] }) +
      "\n";
    await readResearchStream(fakeReader([enc.encode(lines)]), h);

    expect(h.onDelta.mock.calls.map((c) => c[0])).toEqual(["Hello ", "world."]);
    expect(h.onDone).toHaveBeenCalledTimes(1);
    expect(h.onDone.mock.calls[0]?.[0]).toEqual([{ id: "t1" }]);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("reassembles a frame split ACROSS chunk boundaries", async () => {
    const h = handlers();
    const full = JSON.stringify({ type: "delta", text: "spanning" }) + "\n";
    // Cut mid-JSON so neither chunk is a complete line on its own.
    const cut = 10;
    await readResearchStream(
      fakeReader([enc.encode(full.slice(0, cut)), enc.encode(full.slice(cut))]),
      h,
    );

    expect(h.onDelta.mock.calls.map((c) => c[0])).toEqual(["spanning"]);
  });

  it("flushes a final line that arrives WITHOUT a trailing newline", async () => {
    const h = handlers();
    const noNewline = JSON.stringify({ type: "done", turns: [] }); // no "\n"
    await readResearchStream(fakeReader([enc.encode(noNewline)]), h);

    expect(h.onDone).toHaveBeenCalledTimes(1);
  });

  it("dispatches an error frame to onError", async () => {
    const h = handlers();
    const line = JSON.stringify({ type: "error", error: "gateway down" }) + "\n";
    await readResearchStream(fakeReader([enc.encode(line)]), h);

    expect(h.onError).toHaveBeenCalledWith("gateway down");
    expect(h.onDone).not.toHaveBeenCalled();
  });

  it("skips a blank line and an unparseable line without throwing", async () => {
    const h = handlers();
    const mixed =
      "\n" + // blank keep-alive
      "{not json\n" + // garbage
      JSON.stringify({ type: "delta", text: "ok" }) +
      "\n";
    await readResearchStream(fakeReader([enc.encode(mixed)]), h);

    expect(h.onDelta.mock.calls.map((c) => c[0])).toEqual(["ok"]);
    expect(h.onError).not.toHaveBeenCalled();
  });

  // Silent-vanish seam: a slow/aborted gateway can close the stream with NO
  // terminal frame at all. The reader must resolve calling NEITHER onDone nor
  // onError — that "neither" is exactly the state `decideStreamEnd` keys off in
  // ResearchScreen (reconciled=false, sawError=false) to surface a retry.
  it("calls NEITHER onDone nor onError when the stream ends with no terminal frame", async () => {
    const h = handlers();
    await readResearchStream(fakeReader([]), h);

    expect(h.onDone).not.toHaveBeenCalled();
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("calls NEITHER terminal callback on a deltas-then-drop (no done/error)", async () => {
    const h = handlers();
    const deltas =
      JSON.stringify({ type: "delta", text: "partial " }) +
      "\n" +
      JSON.stringify({ type: "delta", text: "answer" }) +
      "\n"; // stream drops here — no done, no error
    await readResearchStream(fakeReader([enc.encode(deltas)]), h);

    expect(h.onDelta.mock.calls.map((c) => c[0])).toEqual(["partial ", "answer"]);
    expect(h.onDone).not.toHaveBeenCalled();
    expect(h.onError).not.toHaveBeenCalled();
  });
});
