import { describe, it, expect } from "vitest";
import {
  decideStreamEnd,
  STREAM_INCOMPLETE_MESSAGE,
} from "@/lib/research/decideStreamEnd";

// -----------------------------------------------------------------------------
// Bugfix — silent vanish on a no-`done` research stream. When a slow/aborted
// gateway closes the stream with NO terminal frame, the reader resolves calling
// neither onDone nor onError, and the handler used to roll back the placeholders
// with no error and no draft restore => the user saw ask -> Thinking… -> nothing.
//
// This pure helper is the terminal decision: given whether the stream reconciled
// (a `done` frame arrived) and whether an `error` frame was already seen, it
// returns the intent the thin handler applies — surface a retry-oriented error
// and restore the draft ONLY for the true silent-vanish case, and NEVER clobber
// an error the route already reported.
// -----------------------------------------------------------------------------

const QUESTION = "What color is the sky?";

describe("decideStreamEnd", () => {
  it("does nothing when the stream reconciled (a done frame arrived)", () => {
    const out = decideStreamEnd({ reconciled: true, sawError: false, question: QUESTION });
    expect(out.setError).toBeUndefined();
    expect(out.restoreDraft).toBeUndefined();
  });

  it("does nothing when an error frame was already seen (no clobber, no draft restore)", () => {
    // The route emitted {type:error}; onError already dispatched SET_ERROR with
    // the route's specific message. The terminal decision must NOT overwrite it
    // with a generic one, and must not fight the user's already-cleared draft.
    const out = decideStreamEnd({ reconciled: false, sawError: true, question: QUESTION });
    expect(out.setError).toBeUndefined();
    expect(out.restoreDraft).toBeUndefined();
  });

  it("surfaces a retry-oriented error AND restores the draft on a zero-terminal-frame end", () => {
    const out = decideStreamEnd({ reconciled: false, sawError: false, question: QUESTION });
    expect(out.setError).toBe(STREAM_INCOMPLETE_MESSAGE);
    expect(out.restoreDraft).toBe(QUESTION);
  });

  it("uses a retry-oriented message, not the generic start-failure text", () => {
    // The user-visible message IS the fix: it must tell them to try again, and
    // must not be the "failed to start" wording used for the throw path.
    expect(STREAM_INCOMPLETE_MESSAGE).toBe("The answer didn't finish streaming. Please try again.");
    expect(STREAM_INCOMPLETE_MESSAGE).not.toMatch(/failed to start/i);
  });
});
