"use client";

import type { EntryWithDetails, Shelf as ShelfKey } from "@/lib/domain/types";
import { useDrag } from "@/components/dnd/DragContext";
import styles from "./EntryTile.module.css";

interface EntryTileProps {
  entry: EntryWithDetails;
  selected: boolean;
  hasContradiction: boolean;
  onSelect: (id: string) => void;
  /** Reorder: drop a tile before this one (insert-before). */
  onDropEntry: (toShelf: ShelfKey, beforeId: string | null) => void;
  /** Move a dragged fact row onto this entry. */
  onDropFactOnEntry: (toEntryId: string) => void;
}

// Entry tile — 172px, 2px ink border, selected = ink fill. Native HTML5 DnD:
// draggable source (an "entry" item) AND a drop target for other tiles
// (insert-before) and for fact rows (move fact here). Drop feedback is driven by
// the shared drag context: `dropTarget` = a tile another tile will insert before;
// `factTarget` = this tile will receive a dragged fact.
export default function EntryTile({
  entry,
  selected,
  hasContradiction,
  onSelect,
  onDropEntry,
  onDropFactOnEntry,
}: EntryTileProps) {
  const drag = useDrag();
  const dragging = drag.dragging;
  const shelf = entry.shelf as ShelfKey;

  const isEntryDropTarget =
    dragging?.type === "entry" &&
    dragging.id !== entry.id &&
    drag.hoverTarget?.type === "entry" &&
    drag.hoverTarget.id === entry.id;

  const isFactDropTarget =
    dragging?.type === "fact" &&
    dragging.from !== entry.id &&
    drag.hoverTarget?.type === "entry" &&
    drag.hoverTarget.id === entry.id;

  const cls = [
    styles.tile,
    selected ? styles.selected : "",
    isEntryDropTarget ? styles.dropTarget : "",
    isFactDropTarget ? styles.factTarget : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      aria-pressed={selected}
      draggable
      onClick={() => onSelect(entry.id)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", entry.id);
        drag.startDrag({ type: "entry", id: entry.id, from: shelf });
      }}
      onDragEnd={() => drag.endDrag()}
      onDragOver={(e) => {
        if (dragging?.type === "entry" && dragging.id === entry.id) return;
        if (dragging?.type === "entry" || dragging?.type === "fact") {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          drag.setHover({ type: "entry", id: entry.id });
        }
      }}
      onDragLeave={() => {
        if (drag.hoverTarget?.type === "entry" && drag.hoverTarget.id === entry.id) {
          drag.setHover(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragging?.type === "entry") onDropEntry(shelf, entry.id);
        else if (dragging?.type === "fact") onDropFactOnEntry(entry.id);
        drag.endDrag();
      }}
    >
      {hasContradiction && (
        <span className={styles.cornerFlag} aria-hidden="true" />
      )}
      <span className={styles.name}>{entry.name}</span>
      <span className={styles.note}>{entry.note}</span>
    </button>
  );
}
