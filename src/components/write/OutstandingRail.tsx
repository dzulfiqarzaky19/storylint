'use client';

/**
 * OutstandingRail (HANDOFF §6/§8) — the 360px right rail:
 *   - "Two signals" legend (two swatches, never merged).
 *   - The outstanding-marks list (one row per live mark). Clicking a row is the
 *     SAME action as clicking the underline (opens/closes the note). One open at
 *     a time; the open row fills `--hover`.
 *   - Empty state when nothing is outstanding.
 *   - The promise block pinned to the bottom (accent), copy verbatim from §6.
 *
 * Presentational: renders `mark.rail` / `mark.quote` verbatim and derives the
 * kind label from `mark.kind` via `railLabel` (never per-mark hardcoding).
 */

import { useId, useState } from 'react';
import type { Mark } from '@/lib/check';
import { railLabel, importanceRank } from '@/lib/check';
import styles from './Manuscript.module.css';

export interface OutstandingRailProps {
  marks: Mark[];
  openMarkKey: string | null;
  onSelect: (markKey: string) => void;
}

export function OutstandingRail({
  marks,
  openMarkKey,
  onSelect,
}: OutstandingRailProps) {
  const allClear = marks.length === 0;
  // Rank by importance (a phrase the author leans on sorts first), preserving
  // document order within a rank via a stable sort. Importance is a RANKING
  // signal only, so every mark still appears; the high-signal ones lead.
  const ordered = marks
    .map((mark, i) => ({ mark, i }))
    .sort(
      (a, b) =>
        importanceRank(a.mark.importance) - importanceRank(b.mark.importance) ||
        a.i - b.i,
    )
    .map((x) => x.mark);
  // Collapsible only matters in the stacked (mobile/tablet) layout, where the
  // rail sits below the manuscript. On desktop the toggle is hidden and the
  // body is always shown (see .railToggle / .railBody in the CSS). Default
  // closed so the phone opens on the manuscript, not a wall of suggestions.
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <aside
      className={`${styles.rail} ${open ? styles.railExpanded : ''}`}
      aria-label="Outstanding marks"
    >
      <button
        type="button"
        className={styles.railToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.railToggleLabel}>
          Two signals
          {marks.length > 0 ? (
            <span className={styles.railToggleCount}>{marks.length}</span>
          ) : null}
        </span>
        <span className={styles.railToggleChevron} aria-hidden>
          {open ? '\u2013' : '+'}
        </span>
      </button>

      <div id={bodyId} className={styles.railBody}>
      <div className={styles.legend}>
        <div className={styles.legendTitle}>Two signals</div>
        <div className={styles.legendRow}>
          <span className={styles.swatchConflict} aria-hidden />
          <span className={styles.legendLabel}>Contradicts the gazetteer</span>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.swatchUnrecorded} aria-hidden />
          <span className={styles.legendLabel}>Not written down yet</span>
        </div>
      </div>

      <div className={styles.railList}>
        {allClear ? (
          <p className={styles.railEmpty}>
            Nothing outstanding. The proof reads itself against the gazetteer as
            you write.
          </p>
        ) : (
          ordered.map((mark) => {
            const conflict = mark.kind === 'conflict';
            const isOpen = mark.markKey === openMarkKey;
            const important = importanceRank(mark.importance) === 0;
            return (
              <button
                key={mark.markKey}
                type="button"
                className={`${styles.railRow} ${isOpen ? styles.railRowOpen : ''} ${important ? styles.railRowImportant : ''}`}
                aria-pressed={isOpen}
                onClick={() => onSelect(mark.markKey)}
              >
                <span
                  className={`${styles.railKind} ${conflict ? styles.railKindConflict : styles.railKindUnrecorded}`}
                >
                  {railLabel(mark.kind)}
                </span>
                <span className={styles.railQuote}>{`\u201c${mark.quote}\u201d`}</span>
                <span className={styles.railReason}>{mark.rail}</span>
              </button>
            );
          })
        )}
      </div>

      <div className={styles.promise}>
        <div className={styles.promiseHead}>
          Nothing enters the gazetteer until you write it in.
        </div>
        <div className={styles.promiseSub}>
          Works with the AI off — the checking is your own wiki, read back at
          you.
        </div>
      </div>
      </div>
    </aside>
  );
}
