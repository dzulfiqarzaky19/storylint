import type { ChapterAppearanceRow } from "@/lib/domain/types";
import styles from "./Timeline.module.css";

interface TimelineProps {
  appearances: ChapterAppearanceRow[];
}

// A book id like "book-lotm-2" carries its ordinal as the trailing number.
// Returns the number for the "Book N" label, or null when the id has none.
function bookNumberOf(bookId: string | null): number | null {
  if (!bookId) return null;
  const m = bookId.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
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

  // A bare "Ch. 1" is ambiguous the moment a book past the first is in play
  // (Book 2 Ch. 1 vs Book 1 Ch. 1), so label the book whenever any appearance
  // sits in a numbered book other than book 1. A one-book entry stays clean.
  const bookNos = appearances.map((a) => bookNumberOf(a.bookId));
  const showBook = bookNos.some((n) => n !== null && n > 1);

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
        const bookNo = bookNos[i];
        const chapterLabel =
          showBook && bookNo != null
            ? `Book ${bookNo} · Ch. ${a.chapter}`
            : `Ch. ${a.chapter}`;
        return (
          <li key={a.id} className={styles.row}>
            <span className={styles.chapter}>{chapterLabel}</span>
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
