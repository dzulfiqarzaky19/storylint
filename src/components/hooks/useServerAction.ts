"use client";

import { useCallback, useTransition } from "react";
import type { ActionResult } from "@/lib/actions/confirmation";

/**
 * The one client-side error-to-string reducer. Client mirror of the server's
 * `errorMessage` (actions/confirmation.ts); was hand-copied 9× across the Screen
 * components (T-ARCH-10). Use for any caught client error before surfacing it.
 */
export function clientErr(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The client half of the server-action envelope. Every screen fires an
 * optimistic reducer/UI update and then persists ALONGSIDE via a Server Action;
 * a failed write must be SURFACED, never swallowed (§8). This packages that
 * ritual — `startTransition` + await + on-`!ok`/on-throw surface — once, so a
 * screen supplies only its own `onError` sink (a `SET_ERROR` dispatch, or a
 * local `setError`). Was reinvented as `settle` / `runAction` / `run` per screen.
 *
 * `run` accepts the in-flight `ActionResult` promise:
 *   - `label` prefixes a THROWN error's message (matches the old `settle` shape);
 *     a returned `{ ok: false }` surfaces its `error` verbatim (already prefixed
 *     server-side by `runAction`).
 *   - `onSuccess` runs only when the write returned `ok: true` (e.g.
 *     `() => router.refresh()` for screens that re-read the server snapshot).
 */
export function useServerAction(onError: (message: string) => void) {
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    (
      promise: Promise<ActionResult<unknown>>,
      opts?: { label?: string; onSuccess?: () => void },
    ) => {
      startTransition(() => {
        promise
          .then((res) => {
            if (!res.ok) onError(res.error);
            else opts?.onSuccess?.();
          })
          .catch((err: unknown) => {
            const msg = clientErr(err);
            onError(opts?.label ? `${opts.label}: ${msg}` : msg);
          });
      });
    },
    [onError],
  );

  return { pending, run };
}
