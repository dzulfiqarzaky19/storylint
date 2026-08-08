"use client";

import type { FactRow } from "@/lib/domain/types";
import { useDrag } from "@/components/dnd/DragContext";
import styles from "./DetailsColumn.module.css";

interface DetailsColumnProps {
  entryId: string;
  facts: FactRow[];
  /** Drop a suggestion card here → add it as a fresh fact on this entry. */
  onDropSuggestion: (suggestionKey: string) => void;
}

// Details column (flex:1): fact rows with 104px key cell. A fresh fact gets the
// --fresh background. Native HTML5 DnD: each fact row is a draggable SOURCE (move
// it onto a tile to reassign the fact) and the whole column is a drop TARGET for
// suggestion cards (add-as-fresh-fact). Card-drop active → --drop background.
export default function DetailsColumn({
  entryId,
  facts,
  onDropSuggestion,
}: DetailsColumnProps) {
  const drag = useDrag();
  const dragging = drag.dragging;

  const isCardDropActive =
    dragging?.type === "card" &&
    drag.dropZone?.type === "board" &&
    drag.dropZone.id === entryId;

  return (
    <div
      className={`${styles.details} ${isCardDropActive ? styles.cardDrop : ""}`}
      onDragOver={(e) => {
        if (dragging?.type !== "card") return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        drag.setZone({ type: "board", id: entryId });
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          if (drag.dropZone?.type === "board" && drag.dropZone.id === entryId) {
            drag.setZone(null);
          }
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragging?.type === "card") onDropSuggestion(dragging.id);
        drag.endDrag();
      }}
    >
      <div className={styles.heading}>
        <h2 className={styles.title}>Details</h2>
      </div>
      <ul className={styles.list}>
        {facts.map((f) => (
          <li
            key={f.id}
            className={`${styles.row} ${f.fresh ? styles.fresh : ""}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", f.id);
              drag.startDrag({ type: "fact", id: f.id, from: entryId });
            }}
            onDragEnd={() => drag.endDrag()}
          >
            <span className={styles.key}>{f.key}</span>
            <span className={styles.value}>{f.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
