"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import type { Dispatch } from "react";
import type { EntryRow } from "@/domain/types";
import { getDeletedEntries, restoreEntry, purgeExpiredDeleted } from "@/server/actions/wiki/trash";
import type { WikiAction } from "@/features/wiki/state";
import { trashCountdown } from "../lib/trashCountdown";
import { clientErr } from "@/hooks/useServerAction";

export interface TrashPanelApi {
  deleted: EntryRow[];
  busy: boolean;
  confirmPurge: boolean;
  setConfirmPurge: (open: boolean) => void;
  nowMs: number;
  purgeableCount: number;
  restore: (id: string) => void;
  purge: () => void;
}

export function useTrashPanel(dispatch: Dispatch<WikiAction>): TrashPanelApi {
  const [deleted, setDeleted] = useState<EntryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [nowMs] = useState(() => Date.now());

  const surfaceError = useCallback(
    (error: string) => dispatch({ type: "SET_ERROR", error }),
    [dispatch],
  );

  const refresh = useCallback(() => {
    startTransition(() => {
      getDeletedEntries()
        .then((res) => {
          if (res.ok) setDeleted(res.data.entries);
          else surfaceError(res.error);
        })
        .catch((err: unknown) => {
          surfaceError(`getDeletedEntries: ${clientErr(err)}`);
        });
    });
  }, [surfaceError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const restore = useCallback(
    (id: string) => {
      setBusy(true);
      startTransition(() => {
        restoreEntry({ id })
          .then((res) => {
            if (res.ok) {
              dispatch({ type: "RESTORE_ENTRY", entry: res.data.entry });
              setDeleted((prev) => prev.filter((e) => e.id !== id));
            } else {
              surfaceError(res.error);
            }
          })
          .catch((err: unknown) => {
            surfaceError(`restoreEntry: ${clientErr(err)}`);
          })
          .finally(() => setBusy(false));
      });
    },
    [dispatch, surfaceError],
  );

  const purge = useCallback(() => {
    setBusy(true);
    startTransition(() => {
      purgeExpiredDeleted({ confirmed: true })
        .then((res) => {
          if (res.ok) refresh();
          else surfaceError(res.error);
        })
        .catch((err: unknown) => {
          surfaceError(`purgeExpiredDeleted: ${clientErr(err)}`);
        })
        .finally(() => setBusy(false));
    });
  }, [refresh, surfaceError]);

  const purgeableCount = deleted.filter(
    (e) => e.deletedAt != null && trashCountdown(e.deletedAt, nowMs).purgeable,
  ).length;

  return {
    deleted,
    busy,
    confirmPurge,
    setConfirmPurge,
    nowMs,
    purgeableCount,
    restore,
    purge,
  };
}
