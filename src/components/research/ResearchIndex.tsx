"use client";

import type { ResearchThreadRow } from "@/lib/domain/types";
import styles from "./ResearchIndex.module.css";

export interface ResearchIndexProps {
  threads: ResearchThreadRow[];
  selectedId: string;
  /** Navigate to a thread (URL-driven; the screen pushes ?thread=<id>). */
  onSelect: (id: string) => void;
  /** Start a new empty thread. */
  onCreate?: () => void;
}

/**
 * The Research LEFT sidebar — a Gemini-style list of conversation threads. One
 * flat list (threads are not grouped), each row a title + subtitle; clicking one
 * loads that thread. Shares the Wiki index's visual language (300px standing
 * rail on desktop, collapsible panel on the stacked tier) so all three screens
 * read as one app.
 */
export default function ResearchIndex({
  threads,
  selectedId,
  onSelect,
  onCreate,
}: ResearchIndexProps) {
  return (
    <nav className={styles.index} aria-label="Research threads">
      <div className={styles.head}>
        <span className={styles.title}>Threads</span>
        <span className={styles.count}>{threads.length}</span>
      </div>

      <ul className={styles.list}>
        {threads.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className={
                t.id === selectedId
                  ? `${styles.item} ${styles.itemActive}`
                  : styles.item
              }
              aria-current={t.id === selectedId ? "true" : undefined}
              onClick={() => onSelect(t.id)}
            >
              <span className={styles.itemName}>{t.title}</span>
              {t.subtitle ? (
                <span className={styles.itemNote}>{t.subtitle}</span>
              ) : null}
            </button>
          </li>
        ))}
        {onCreate ? (
          <li>
            <button type="button" className={styles.add} onClick={onCreate}>
              + New thread
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
