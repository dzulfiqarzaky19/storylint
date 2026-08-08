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

import type { Mark } from '@/lib/check';
import { railLabel } from '@/lib/check';
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
  return (
    <aside className={styles.rail} aria-label="Outstanding marks">
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
          marks.map((mark) => {
            const conflict = mark.kind === 'conflict';
            const open = mark.markKey === openMarkKey;
            return (
              <button
                key={mark.markKey}
                type="button"
                className={`${styles.railRow} ${open ? styles.railRowOpen : ''}`}
                aria-pressed={open}
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
    </aside>
  );
}
