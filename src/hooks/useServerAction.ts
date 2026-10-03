"use client";

import { useCallback, useTransition } from "react";
import type { ActionResult } from "@/domain/result";

export function clientErr(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

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
