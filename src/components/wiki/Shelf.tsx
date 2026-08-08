"use client";

import type { EntryWithDetails, Shelf as ShelfKey } from "@/lib/domain/types";
import { useDrag } from "@/components/dnd/DragContext";
import EntryTile from "./EntryTile";
import styles from "./Shelf.module.css";

interface ShelfProps {
  shelf: ShelfKey;
  title: string;
  entries: EntryWithDetails[];
  selectedId: string;
  /** Entry ids the check engine flags with an unresolved contradiction. */
  contradictions: Set<string>;
  onSelect: (id: string) => void;
  /** Reorder within/across shelves; beforeId=null means append to this shelf. */
  onDropEntry: (toShelf: ShelfKey, beforeId: string | null) => void;
  onDropFactOnEntry: (toEntryId: string) => void;
}

// One shelf group — heading row then wrapping tiles (README Screen 1 "Shelves").
// The shelf itself is a drop zone: dropping a tile on the empty space APPENDS it
// here and REGROUPS it (changes its kind/shelf). Zone fills --hover while active.
export default function Shelf({
  shelf,
  title,
  entries,
  selectedId,
  contradictions,
  onSelect,
  onDropEntry,
  onDropFactOnEntry,
}: ShelfProps) {
  const drag = useDrag();
  const dragging = drag.dragging;

  const isZoneActive =
    dragging?.type === "entry" &&
    drag.dropZone?.type === "shelf" &&
    drag.dropZone.id === shelf;

  return (
    <section
      className={`${styles.shelf} ${isZoneActive ? styles.zoneActive : ""}`}
      aria-label={title}
      onDragOver={(e) => {
        if (dragging?.type !== "entry") return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        drag.setZone({ type: "shelf", id: shelf });
      }}
      onDragLeave={(e) => {
        // Only clear when the pointer truly leaves the shelf, not a child tile.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          if (drag.dropZone?.type === "shelf" && drag.dropZone.id === shelf) {
            drag.setZone(null);
          }
        }
      }}
      onDrop={(e) => {
        // A tile dropped on a tile is handled by the tile (insert-before); this
        // fires only for the shelf's empty space → append + regroup.
        e.preventDefault();
        if (dragging?.type === "entry") onDropEntry(shelf, null);
        drag.endDrag();
      }}
    >
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
            hasContradiction={contradictions.has(entry.id)}
            onSelect={onSelect}
            onDropEntry={onDropEntry}
            onDropFactOnEntry={onDropFactOnEntry}
          />
        ))}
      </div>
    </section>
  );
}
