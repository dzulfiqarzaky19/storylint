import type { FactRow } from "@/lib/domain/types";
import styles from "./DetailsColumn.module.css";

interface DetailsColumnProps {
  facts: FactRow[];
}

// Details column (flex:1): fact rows with 104px key cell. A fresh fact gets the
// --fresh background (README Screen 1 "Details"). Drag/drop is Phase 4.
export default function DetailsColumn({ facts }: DetailsColumnProps) {
  return (
    <div className={styles.details}>
      <div className={styles.heading}>
        <h2 className={styles.title}>Details</h2>
      </div>
      <ul className={styles.list}>
        {facts.map((f) => (
          <li
            key={f.id}
            className={`${styles.row} ${f.fresh ? styles.fresh : ""}`}
          >
            <span className={styles.key}>{f.key}</span>
            <span className={styles.value}>{f.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
