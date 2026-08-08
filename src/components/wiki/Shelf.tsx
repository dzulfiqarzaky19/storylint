import type { EntryWithDetails } from "@/lib/domain/types";
import EntryTile from "./EntryTile";
import styles from "./Shelf.module.css";

interface ShelfProps {
  title: string;
  entries: EntryWithDetails[];
  selectedId: string;
  onSelect: (id: string) => void;
}

// A tile carries a contradiction flag when the entry has a red-flagged
// appearance. In Phase 4 this comes from the check engine's unresolved marks;
// for read-only Phase 3 the seeded red timeline flag is the source of truth.
function hasContradiction(entry: EntryWithDetails): boolean {
  return entry.appearances.some((a) => a.flag === "red");
}

// One shelf group — heading row (title, count, flex rule line) then wrapping
// tiles (README Screen 1 "Shelves").
export default function Shelf({
  title,
  entries,
  selectedId,
  onSelect,
}: ShelfProps) {
  return (
    <section className={styles.shelf} aria-label={title}>
      <div className={styles.heading}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.count}>{entries.length}</span>
        <span className={styles.line} aria-hidden="true" />
      </div>
      <div className={styles.tiles}>
        {entries.map((entry) => (
          <EntryTile
            key={entry.id}
            entry={entry}
            selected={entry.id === selectedId}
            hasContradiction={hasContradiction(entry)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
