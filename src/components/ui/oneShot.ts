/* Pure one-shot guard for ConfirmModal's async double-submit protection.
   Extracted so the "fire the first click, swallow the rest until re-open"
   decision is unit-testable in the node test env (the repo has no DOM test
   environment; the DOM wiring in ConfirmModal.tsx is covered by a Firefox drive
   + an e2e double-click, same split as focusTrap.ts / nextFocusIndex). No DOM
   or React types leak in here: it is a plain closure over a boolean latch. */

/** A re-armable one-shot latch: `fire` runs its callback only the first time,
    `reset` re-arms it for the next open, `fired` reports the spent state. */
export interface OneShot {
  /** Invoke `cb` iff this shot has not fired since the last reset; else no-op. */
  fire: (cb: () => void) => void;
  /** Re-arm the shot so the next `fire` runs again (call on each modal open). */
  reset: () => void;
  /** Whether the shot has already fired since the last reset. */
  fired: () => boolean;
}

/**
 * Create a re-armable one-shot latch.
 *
 * ConfirmModal wraps the caller's `onConfirm` in `fire`, so a real double-click
 * on an async confirm (where the modal only unmounts AFTER an awaited delete)
 * fires `onConfirm` exactly ONCE. `reset` is called whenever the modal opens, so
 * the guard is per-open, not per-lifetime — a legitimate later delete on the
 * same mounted modal still fires. `fired()` drives the disabled/aria-disabled
 * state on the confirm button.
 */
export function createOneShot(): OneShot {
  let spent = false;
  return {
    fire(cb: () => void) {
      if (spent) return;
      spent = true;
      cb();
    },
    reset() {
      spent = false;
    },
    fired() {
      return spent;
    },
  };
}
