import type { ResolvedTie } from "@/lib/domain/types";
import styles from "./TiesBlock.module.css";

interface TiesBlockProps {
  ties: ResolvedTie[];
  onSelect: (id: string) => void;
}

// Ties block — clickable rows select that entry (README Interactions: "Click a
// tie row → Selects that entry"). Drop target behavior is Phase 4; the 2px
// transparent border is kept so the drop state has somewhere to land later.
export default function TiesBlock({ ties, onSelect }: TiesBlockProps) {
  return (
    <div className={styles.block}>
      <div className={styles.heading}>
        <h2 className={styles.title}>Ties</h2>
        <span className={styles.count}>{ties.length}</span>
      </div>
      <ul className={styles.list}>
        {ties.map((t) => (
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
        ))}
      </ul>
      <p className={styles.hint}>
        Drop any tile from below onto this column to tie it in.
      </p>
    </div>
  );
}
