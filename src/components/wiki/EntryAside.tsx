"use client";

import type { EntryWithDetails } from "@/lib/domain/types";
import PortraitPlaceholder from "./PortraitPlaceholder";
import TiesBlock from "./TiesBlock";
import styles from "./EntryAside.module.css";

interface EntryAsideProps {
  entry: EntryWithDetails;
  onSelect: (id: string) => void;
  /** Drop a tile here → tie it to the selected entry. */
  onDropOnTies: () => void;
}

// Entry band right column, fixed 340px (README Screen 1).
export default function EntryAside({
  entry,
  onSelect,
  onDropOnTies,
}: EntryAsideProps) {
  return (
    <aside className={styles.aside} aria-label="Portrait and ties">
      <PortraitPlaceholder />
      <TiesBlock ties={entry.ties} onSelect={onSelect} onDropOnTies={onDropOnTies} />
    </aside>
  );
}
