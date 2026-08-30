"use client";

import type { EntryWithDetails } from "@/lib/domain/types";
import { chapterCitesFor } from "@/lib/wiki/chapterCite";
import InlineText from "./InlineText";
import styles from "./OverviewTab.module.css";

interface OverviewTabProps {
  entry: EntryWithDetails;
  onEditSummary: (value: string) => void;
}

/**
 * Overview tab, v1 — DETERMINISTIC (T-WIKI-COCKPIT-1 ruling). Both blocks read
 * fields that already exist: Summary is the writer's editable `entry.summary`,
 * Latest is the tail of `entry.appearances`. No AI, no new schema; the
 * AI-synthesized Summary lands in T-WIKI-COCKPIT-5.
 */
export default function OverviewTab({
  entry,
  onEditSummary,
}: OverviewTabProps) {
  // Appearances arrive sorted (sortOrder), so the newest beat is the tail.
  const latest = entry.appearances[entry.appearances.length - 1] ?? null;
  const latestCite = latest
    ? chapterCitesFor(entry.appearances)[entry.appearances.length - 1]
    : null;

  return (
    <div className={styles.overview}>
      <section className={styles.block}>
        <h2 className={styles.sectionTitle}>Summary</h2>
        <p className={styles.prose}>
          <InlineText
            value={entry.summary}
            ariaLabel="entry summary"
            multiline
            placeholder="Add a summary"
            onCommit={onEditSummary}
          />
        </p>
      </section>

      <section className={styles.block}>
        <h2 className={styles.sectionTitle}>
          Latest
          <span className={styles.meta}>
            · newest chapter that touches this entry
          </span>
        </h2>
        {latest ? (
          <div className={styles.latest}>
            <p className={styles.prose}>{latest.text}</p>
            <div className={styles.metaRow}>
              <span className={styles.cite}>{latestCite}</span>
              {latest.flag !== null && (
                <span className={styles.flag}>{latest.flagText}</span>
              )}
            </div>
          </div>
        ) : (
          <p className={styles.fallback}>Not in the manuscript yet.</p>
        )}
      </section>
    </div>
  );
}
