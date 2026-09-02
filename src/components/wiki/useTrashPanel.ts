"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import type { EntryRow, EntryWithDetails } from "@/lib/domain/types";
import { getDeletedEntries, restoreEntry, purgeExpiredDeleted } from "@/lib/actions/wiki";
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
  /** Restore one entry; the caller re-inserts it into the live reducer. */
  restore: (id: string, onRestored: (entry: EntryWithDetails) => void) => void;
  /** Purge every retention-elapsed entry, then refresh the list. */
  purge: () => void;
}

/**
 * The /wiki trash panel side-feature, lifted out of WikiScreen (T-ARCH-13). The
 * trash list is panel-LOCAL server state (soft-deleted entries live only in the
 * DB, never in the reducer's live byId), so it is fetched here and re-fetched
 * after every restore/purge. `restore` hands the restored row back through
 * `onRestored` so the caller can dispatch RESTORE_ENTRY into its own reducer;
 * purge changes nothing live and just refreshes. `onError` surfaces failures.
 */
export function useTrashPanel(onError: (message: string) => void): TrashPanelApi {
  const [deleted, setDeleted] = useState<EntryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  // Fixed at mount so the countdown labels don't reflow every render.
  const [nowMs] = useState(() => Date.now());

  const refresh = useCallback(() => {
    startTransition(() => {
      getDeletedEntries()
        .then((res) => {
          if (res.ok) setDeleted(res.data.entries);
          else onError(res.error);
        })
        .catch((err: unknown) => {
          onError(`getDeletedEntries: ${clientErr(err)}`);
        });
    });
  }, [onError]);

  // Load the trash once on mount, then re-fetch after each delete via restore/purge.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const restore = useCallback(
    (id: string, onRestored: (entry: EntryWithDetails) => void) => {
      setBusy(true);
      startTransition(() => {
        restoreEntry({ id })
          .then((res) => {
            if (res.ok) {
              onRestored(res.data.entry);
              setDeleted((prev) => prev.filter((e) => e.id !== id));
            } else {
              onError(res.error);
            }
          })
          .catch((err: unknown) => {
            onError(`restoreEntry: ${clientErr(err)}`);
          })
          .finally(() => setBusy(false));
      });
    },
    [onError],
  );

  const purge = useCallback(() => {
    setBusy(true);
    startTransition(() => {
      purgeExpiredDeleted({ confirmed: true })
        .then((res) => {
          if (res.ok) refresh();
          else onError(res.error);
        })
        .catch((err: unknown) => {
          onError(`purgeExpiredDeleted: ${clientErr(err)}`);
        })
        .finally(() => setBusy(false));
    });
  }, [refresh, onError]);

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
