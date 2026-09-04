"use client";

import type { EntryWithDetails } from "@/lib/domain/types";
import { chapterCitesFor } from "@/lib/wiki/chapterCite";
import styles from "./OverviewTab.module.css";

interface OverviewTabProps {
  entry: EntryWithDetails;
  /** T-WIKI-COCKPIT-5 STUB: AI synthesis text (wired to generateOverviewSynthesis later). */
  aiSynthesis?: string;
}

/**
 * Overview tab — DETERMINISTIC. Latest is the tail of `entry.appearances`; no AI,
 * no new schema.
 *
 * The writer's `entry.summary` is NOT here: it is the head blurb under the entry
 * name (EntryBand), matching the prototype and keeping one edit surface per
 * value. Overview's own summary slot is the deferred AI synthesis.
 */
export default function OverviewTab({ entry, aiSynthesis }: OverviewTabProps) {
  // Appearances arrive sorted (sortOrder), so the newest beat is the tail.
  const latest = entry.appearances[entry.appearances.length - 1] ?? null;
  const latestCite = latest
    ? chapterCitesFor(entry.appearances)[entry.appearances.length - 1]
    : null;

  return (
    <div className={styles.overview}>
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
      {/* T-WIKI-COCKPIT-5 STUB: AI synthesis section (wired to generateOverviewSynthesis later) */}
      {aiSynthesis !== undefined && (
        <section className={styles.block}>
          <h2 className={styles.sectionTitle}>
            AI Synopsis
            <span className={styles.aiBadge}>AI</span>
          </h2>
          <p className={styles.aiProse}>{aiSynthesis}</p>
          <p className={styles.aiHint}>Edit the summary to override this synthesis.</p>
        </section>
      )}
    </div>
  );
}
