"use client";

import type { EntryWithDetails } from "@/lib/domain/types";
import styles from "./EntryTile.module.css";

interface EntryTileProps {
  entry: EntryWithDetails;
  selected: boolean;
  hasContradiction: boolean;
  onSelect: (id: string) => void;
}

// Entry tile — 172px, 2px ink border, selected = ink fill. Clicking selects it
// and re-renders the entry band (README Interactions). Keyboard reachable button.
export default function EntryTile({
  entry,
  selected,
  hasContradiction,
  onSelect,
}: EntryTileProps) {
  return (
    <button
      type="button"
      className={`${styles.tile} ${selected ? styles.selected : ""}`}
      aria-pressed={selected}
      onClick={() => onSelect(entry.id)}
    >
      {hasContradiction && (
        <span className={styles.cornerFlag} aria-hidden="true" />
      )}
      <span className={styles.name}>{entry.name}</span>
      <span className={styles.note}>{entry.note}</span>
    </button>
  );
}
