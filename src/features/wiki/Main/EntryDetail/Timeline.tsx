import type { ChapterAppearanceRow } from "@/lib/domain/types";
import { appearLine } from "@/lib/domain/derive";
import { chapterCitesFor } from "./lib/chapterCite";
import styles from "./Timeline.module.css";

interface TimelineProps {
  appearances: ChapterAppearanceRow[];
}

export default function Timeline({ appearances }: TimelineProps) {
  const chapterCount = appearances.length;
  const flaggedCount = appearances.filter((a) => a.flag !== null).length;

  return (
    <div className={styles.tab}>
      <div className={styles.heading}>
        <h2 className={styles.sectionTitle}>The story so far</h2>
        <span className={styles.meta}>
          {appearLine(chapterCount, flaggedCount)}
        </span>
      </div>
      {appearances.length === 0 ? (
        <ul className={styles.list}>
          <li className={styles.row}>
            <span className={styles.chapter}>—</span>
            <span className={styles.text}>Not in the manuscript yet.</span>
          </li>
        </ul>
      ) : (
        <TimelineRows appearances={appearances} />
      )}
    </div>
  );
}

function TimelineRows({ appearances }: TimelineProps) {
  const cites = chapterCitesFor(appearances);
  return (
    <ul className={styles.list}>
      {appearances.map((a, i) => {
        const flagClass =
          a.flag === "red"
            ? styles.flagRed
            : a.flag === "yellow"
              ? styles.flagSoft
              : undefined;
        return (
          <li key={a.id} className={styles.row}>
            <span className={styles.chapter}>{cites[i]}</span>
            <span className={styles.text}>{a.text}</span>
            {a.flag !== null && (
              <span className={`${styles.flag} ${flagClass ?? ""}`}>
                {a.flagText}
              </span>
            )}
            <a
              href={`/write?chapter=${a.chapter}`}
              className={styles.chapterLink}
              aria-label={`Jump to chapter ${a.chapter}`}
              title={`Open chapter ${a.chapter} in the manuscript`}
            >
              Jump to {cites[i]}  ↗
            </a>
          </li>
        );
      })}
    </ul>
  );
}
