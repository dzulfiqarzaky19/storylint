import type { ChapterAppearanceRow } from "@/lib/domain/types";
import { chapterCitesFor } from "@/lib/wiki/chapterCite";
import styles from "./Timeline.module.css";

interface TimelineProps {
  appearances: ChapterAppearanceRow[];
}

// "The story so far" timeline rows. Entries with no appearances render one
// placeholder row.
export default function Timeline({ appearances }: TimelineProps) {
  if (appearances.length === 0) {
    return (
      <ul className={styles.list}>
        <li className={styles.row}>
          <span className={styles.chapter}>—</span>
          <span className={styles.text}>Not in the manuscript yet.</span>
        </li>
      </ul>
    );
  }

  const cites = chapterCitesFor(appearances);

  return (
    <ul className={styles.list}>
      {appearances.map((a, i) => {
        // red = contradiction (accent), yellow = softer mismatch (grey).
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