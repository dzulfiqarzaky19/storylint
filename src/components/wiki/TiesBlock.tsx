"use client";

import type { ResolvedTie } from "@/lib/domain/types";
import { resolveDanglingTies } from "@/lib/wiki/danglingTies";
import { useDrag } from "@/components/dnd/DragContext";
import styles from "./TiesBlock.module.css";

interface TiesBlockProps {
  ties: ResolvedTie[];
  /** Ids of every LIVE (non-deleted) entry — a tie to anything else is dangling. */
  liveEntryIds: Set<string>;
  onSelect: (id: string) => void;
  /** Drop a tile from a shelf here → tie it to the selected entry. */
  onDropOnTies: () => void;
}

// Ties block — clickable rows select that entry. Native HTML5 drop TARGET: drag
// a tile from a shelf onto this column to create a `linked` tie. Active drop gets
// a 2px accent border + --drop background (README Interactions).
export default function TiesBlock({ ties, liveEntryIds, onSelect, onDropOnTies }: TiesBlockProps) {
  const drag = useDrag();
  const dragging = drag.dragging;

  // A tie whose target is no longer live (soft-deleted or purged) renders as a
  // RED "removed — needs replacement" tombstone instead of a clickable link.
  const resolved = resolveDanglingTies(liveEntryIds, ties);

  const isDropActive =
    dragging?.type === "entry" &&
    drag.dropZone?.type === "ties" &&
    drag.dropZone.id === "ties";

  return (
    <div
      className={`${styles.block} ${isDropActive ? styles.dropActive : ""}`}
      onDragOver={(e) => {
        if (dragging?.type !== "entry") return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "link";
        drag.setZone({ type: "ties", id: "ties" });
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          if (drag.dropZone?.type === "ties") drag.setZone(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragging?.type === "entry") onDropOnTies();
        drag.endDrag();
      }}
    >
      <div className={styles.heading}>
        <h2 className={styles.title}>Ties</h2>
        <span className={styles.count}>{ties.length}</span>
      </div>
      <ul className={styles.list}>
        {resolved.map(({ tie: t, tombstoned, removedName }) =>
          tombstoned ? (
            <li key={t.id}>
              <div className={styles.tombstone} role="note">
                <span className={styles.tombstoneName}>{removedName}</span>
                <span className={styles.tombstoneNote}>removed — needs replacement</span>
              </div>
            </li>
          ) : (
            <li key={t.id}>
              <button
                type="button"
                className={styles.row}
                onClick={() => onSelect(t.toEntryId)}
              >
                <span className={styles.name}>{t.toName}</span>
                <span className={styles.rel}>{t.rel}</span>
              </button>
            </li>
          ),
        )}
      </ul>
      <p className={styles.hint}>
        Drop any tile from below onto this column to tie it in.
      </p>
    </div>
  );
}
