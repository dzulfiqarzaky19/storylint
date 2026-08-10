// Bugfix — the terminal decision for a research stream that ended.
//
// A streamed answer ends one of three ways:
//   - reconciled: a `done` frame arrived and RECONCILE_TURN ran. Success — the
//     placeholders became persisted turns; nothing more to do.
//   - sawError: an `error` frame arrived and the handler already dispatched
//     SET_ERROR with the route's specific message. Do NOT clobber it.
//   - neither: the stream closed with no terminal frame (slow/aborted gateway,
//     dropped connection, or deltas-then-drop). The handler rolls back the
//     placeholders; without this decision the user would see nothing at all.
//
// This is a pure function so the guard is unit-testable without a DOM; the
// handler is a thin wire that applies the returned intent (SET_ERROR if
// `setError`, setDraft if `restoreDraft`).

/** User-visible message for a stream that ended without finishing. Retry-oriented. */
export const STREAM_INCOMPLETE_MESSAGE = "The answer didn't finish streaming. Please try again.";

export interface StreamEndInput {
  /** A `done` frame arrived and the turns were reconciled. */
  reconciled: boolean;
  /** An `error` frame arrived; the route already surfaced a specific message. */
  sawError: boolean;
  /** The question just asked, restored to the draft so it stays retryable. */
  question: string;
}

export interface StreamEndDecision {
  /** Surface this error message, or undefined to leave the current error alone. */
  setError?: string;
  /** Restore this text to the draft, or undefined to leave the draft cleared. */
  restoreDraft?: string;
}

/**
 * Decide what the handler should do when the stream has ended. Returns an empty
 * decision on success or on an already-reported error; returns a retry-oriented
 * error + a draft restore only for the true silent-vanish case (no terminal
 * frame at all).
 */
export function decideStreamEnd(input: StreamEndInput): StreamEndDecision {
  if (input.reconciled || input.sawError) return {};
  return { setError: STREAM_INCOMPLETE_MESSAGE, restoreDraft: input.question };
}
