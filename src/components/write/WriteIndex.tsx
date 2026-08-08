"use client";

import styles from "./WriteIndex.module.css";

export interface WriteIndexChapter {
  number: number;
  title: string;
}

export interface WriteIndexProps {
  chapters: WriteIndexChapter[];
  selectedNumber: number;
  /** Navigate to a chapter (URL-driven; the screen pushes ?chapter=<n>). */
  onSelect: (n: number) => void;
  /** Append a new empty chapter. */
  onCreate?: () => void;
}

/** Spell small chapter numbers ("Chapter seven") to match the manuscript eyebrow. */
function numberWord(n: number): string {
  const words = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve",
  ];
  return words[n] ?? String(n);
}

/**
 * The Write LEFT sidebar — the chapter list. One flat, ordered list; clicking a
 * chapter loads it. Shares the Wiki/Research index visual language (300px
 * standing rail on desktop, collapsible panel <=1200px) so all three screens
 * read as one app.
 */
export default function WriteIndex({
  chapters,
  selectedNumber,
  onSelect,
  onCreate,
}: WriteIndexProps) {
  return (
    <nav className={styles.index} aria-label="Chapters">
      <div className={styles.head}>
        <span className={styles.title}>Chapters</span>
        <span className={styles.count}>{chapters.length}</span>
      </div>

      <ul className={styles.list}>
        {chapters.map((c) => (
          <li key={c.number}>
            <button
              type="button"
              className={
                c.number === selectedNumber
                  ? `${styles.item} ${styles.itemActive}`
                  : styles.item
              }
              aria-current={c.number === selectedNumber ? "true" : undefined}
              onClick={() => onSelect(c.number)}
            >
              <span className={styles.itemNote}>
                Chapter {numberWord(c.number)}
              </span>
              <span className={styles.itemName}>{c.title}</span>
            </button>
          </li>
        ))}
        {onCreate ? (
          <li>
            <button type="button" className={styles.add} onClick={onCreate}>
              + New chapter
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
