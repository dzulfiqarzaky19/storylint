import type { ChapterAppearanceRow } from "@/lib/domain/types";
import styles from "./Timeline.module.css";

interface TimelineProps {
  appearances: ChapterAppearanceRow[];
}

// "The story so far" timeline rows. Entries with no appearances render one
// placeholder row (HANDOFF §6 timeline note).
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

  return (
    <ul className={styles.list}>
      {appearances.map((a) => {
        // red = contradiction (accent), yellow = softer mismatch (grey).
        const flagClass =
          a.flag === "red"
            ? styles.flagRed
            : a.flag === "yellow"
              ? styles.flagSoft
              : undefined;
        return (
          <li key={a.id} className={styles.row}>
            <span className={styles.chapter}>Ch. {a.chapter}</span>
            <span className={styles.text}>{a.text}</span>
            {a.flag !== null && (
              <span className={`${styles.flag} ${flagClass ?? ""}`}>
                {a.flagText}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
