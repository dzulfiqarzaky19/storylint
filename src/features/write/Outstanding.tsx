'use client';

import { useId, useState } from 'react';
import type { Mark } from '@/domain/check';
import { railLabel, importanceRank } from '@/domain/check';
import { Chevron } from '@/components/shell/RowIcons';
import styles from './Outstanding.module.css';

export interface OutstandingProps {
  marks: Mark[];
  openMarkKey: string | null;
  onSelect: (markKey: string) => void;
}

export default function Outstanding({
  marks,
  openMarkKey,
  onSelect,
}: OutstandingProps) {
  const allClear = marks.length === 0;
  const ordered = marks
    .map((mark, i) => ({ mark, i }))
    .sort(
      (a, b) =>
        importanceRank(a.mark.importance) - importanceRank(b.mark.importance) ||
        a.i - b.i,
    )
    .map((x) => x.mark);
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
          Outstanding
          {marks.length > 0 ? (
            <span className={styles.railToggleCount}>{marks.length}</span>
          ) : null}
        </span>
        <span
          className={`${styles.railToggleChevron}${open ? ` ${styles.chevronOpen}` : ''}`}
          aria-hidden
        >
          <Chevron />
        </span>
      </button>

      <div id={bodyId} className={styles.railBody}>
      <div className={styles.boardHead}>
        <span className={styles.boardTitle}>Outstanding</span>
        <span className={styles.boardCount}>{marks.length}</span>
      </div>
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
        <h2 className={styles.promiseHead}>
          Nothing enters the gazetteer until you write it in.
        </h2>
        <div className={styles.promiseSub}>
          Works with the AI off — the checking is your own wiki, read back at
          you.
        </div>
      </div>
      </div>
    </aside>
  );
}
