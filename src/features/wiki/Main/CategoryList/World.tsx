import { worldLine } from "@/features/wiki/lib/derive";
import styles from "./World.module.css";

interface WorldProps {
  entryCount: number;
}

export default function World({ entryCount }: WorldProps) {
  return (
    <section className={styles.band} aria-label="The world">
      <div className={styles.row}>
        <h2 className={styles.title}>The world</h2>
        <span className={styles.meta}>{worldLine(entryCount)}</span>
      </div>
    </section>
  );
}
