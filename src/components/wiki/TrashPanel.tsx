"use client";

// F6-S6b — the "Recently deleted" trash panel. Purely presentational: it renders
// the soft-deleted entries the orchestrator (WikiScreen) fetched, and wires each
// Restore button + the single "Empty trash" purge button to callbacks the caller
// owns. It holds NO server-action or reducer logic — restore/purge/refetch all
// live in WikiScreen (§8 write-through). The one decision it consumes is
// trashCountdown (pure, unit-locked in trashCountdown.test.ts).
//
// The whole panel is HIDDEN when the trash is empty (no empty-state chrome): the
// caller renders <TrashPanel> only when entries.length > 0.

import type { EntryRow } from "@/lib/domain/types";
import { KIND_LABEL } from "@/lib/domain/types";
import { trashCountdown } from "@/lib/wiki/trashCountdown";
import styles from "./TrashPanel.module.css";

export interface TrashPanelProps {
  /** Soft-deleted entries, newest-deletion-first (from getDeletedEntries). */
  entries: EntryRow[];
  /** Clock for the countdown (injected so the label is deterministic/testable). */
  nowMs: number;
  /** True while a restore/purge server action is in flight (disables buttons). */
  busy?: boolean;
  /** Restore one entry into the live wiki (non-destructive; no confirm needed). */
  onRestore: (id: string) => void;
  /** Ask to purge every expired entry (opens the danger confirm in the caller). */
  onRequestPurge: () => void;
}

function formatDeletedAt(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * "Recently deleted (N)" panel. Lists each soft-deleted entry with its name,
 * kind, deletion date, and a countdown ("purges in N days" / "ready to purge"),
 * a per-row Restore button, and a footer "Empty trash" button that routes
 * through the caller's danger confirm.
 */
export default function TrashPanel({
  entries,
  nowMs,
  busy = false,
  onRestore,
  onRequestPurge,
}: TrashPanelProps) {
  const purgeableCount = entries.filter(
    (e) => e.deletedAt != null && trashCountdown(e.deletedAt, nowMs).purgeable,
  ).length;

  return (
    <section className={styles.trash} aria-label="Recently deleted">
      <header className={styles.head}>
        <h2 className={styles.title}>Recently deleted</h2>
        <span className={styles.count}>{entries.length}</span>
      </header>

      <ul className={styles.list}>
        {entries.map((e) => {
          const c =
            e.deletedAt != null
              ? trashCountdown(e.deletedAt, nowMs)
              : { purgeable: false, daysLeft: 0 };
          return (
            <li key={e.id} className={styles.item}>
              <div className={styles.meta}>
                <span className={styles.name}>{e.name}</span>
                <span className={styles.sub}>
                  {KIND_LABEL[e.kind]}
                  {e.deletedAt != null ? (
                    <>
                      {" \u00b7 "}
                      deleted {formatDeletedAt(e.deletedAt)}
                    </>
                  ) : null}
                </span>
                <span
                  className={c.purgeable ? styles.expiryReady : styles.expiry}
                >
                  {c.purgeable
                    ? "Ready to purge"
                    : `Purges in ${c.daysLeft} ${c.daysLeft === 1 ? "day" : "days"}`}
                </span>
              </div>
              <button
                type="button"
                className={styles.restore}
                onClick={() => onRestore(e.id)}
                disabled={busy}
              >
                Restore
              </button>
            </li>
          );
        })}
      </ul>

      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.purge}
          onClick={onRequestPurge}
          disabled={busy || purgeableCount === 0}
          aria-label={`Empty trash: permanently delete ${purgeableCount} expired ${
            purgeableCount === 1 ? "entry" : "entries"
          }`}
        >
          Empty trash{purgeableCount > 0 ? ` (${purgeableCount})` : ""}
        </button>
      </footer>
    </section>
  );
}
