import type { EntryWithDetails } from "@/lib/domain/types";
import PortraitPlaceholder from "./PortraitPlaceholder";
import TiesBlock from "./TiesBlock";
import styles from "./EntryAside.module.css";

interface EntryAsideProps {
  entry: EntryWithDetails;
  onSelect: (id: string) => void;
}

// Entry band right column, fixed 340px (README Screen 1).
export default function EntryAside({ entry, onSelect }: EntryAsideProps) {
  return (
    <aside className={styles.aside} aria-label="Portrait and ties">
      <PortraitPlaceholder />
      <TiesBlock ties={entry.ties} onSelect={onSelect} />
    </aside>
  );
}
