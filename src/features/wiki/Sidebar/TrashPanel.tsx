"use client";

import type { EntryRow } from "@/domain/types";
import { kindLabelOf } from "@/domain/types";
import { trashCountdown } from "./lib/trashCountdown";
import styles from "./TrashPanel.module.css";

export interface TrashPanelProps {
  entries: EntryRow[];
  nowMs: number;
  busy?: boolean;
  onRestore: (id: string) => void;
  onRequestPurge: () => void;
}

function formatDeletedAt(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
                  {kindLabelOf(e.kind)}
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
