"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import type { Dispatch } from "react";
import type { EntryRow } from "@/lib/domain/types";
import { getDeletedEntries, restoreEntry, purgeExpiredDeleted } from "@/lib/actions/wiki";
import type { WikiAction } from "@/lib/state/wikiStore";
import { trashCountdown } from "@/lib/wiki/trashCountdown";
import { clientErr } from "@/components/hooks/useServerAction";

export interface TrashPanelApi {
  /** Soft-deleted entries (panel-local server state; never in the reducer). */
  deleted: EntryRow[];
  /** True while a restore/purge is in flight. */
  busy: boolean;
  /** Whether the purge danger-modal is open. */
  confirmPurge: boolean;
  setConfirmPurge: (open: boolean) => void;
  /** Fixed-at-mount clock so countdown labels don't reflow each render. */
  nowMs: number;
  /** How many trashed entries the next purge would actually remove. */
  purgeableCount: number;
  /** Restore one entry into the live gazetteer and drop it from the panel. */
  restore: (id: string) => void;
  /** Purge every retention-elapsed entry, then refresh the list. */
  purge: () => void;
}

/**
 * The /wiki trash panel. The trash list is panel-LOCAL server state
 * (soft-deleted entries live only in the DB, never in the reducer's live
 * byId), so it is fetched here and re-fetched after every restore/purge.
 *
 * Restore is not a fire-and-forget write-through: the live row does not exist
 * in session state until the server returns it. The panel owns that ordering
 * — await the row, dispatch RESTORE_ENTRY, drop it from the panel — so the
 * screen never learns the action or the two-step. Purge changes nothing live
 * and just refreshes. Failures surface through SET_ERROR on the same dispatch.
 */
export function useTrashPanel(dispatch: Dispatch<WikiAction>): TrashPanelApi {
  const [deleted, setDeleted] = useState<EntryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  // Fixed at mount so the countdown labels don't reflow every render.
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

  // Load the trash once on mount, then re-fetch after each delete via restore/purge.
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

  // How many trashed entries the next purge would actually remove (retention
  // elapsed) — drives the danger-modal copy's exact count.
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
