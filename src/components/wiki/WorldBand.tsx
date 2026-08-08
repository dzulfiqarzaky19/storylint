import { worldLine } from "@/lib/domain/derive";
import styles from "./WorldBand.module.css";

interface WorldBandProps {
  entryCount: number;
}

// World band — 2px ink rule then "The world" + derived meta (README Screen 1).
export default function WorldBand({ entryCount }: WorldBandProps) {
  return (
    <section className={styles.band} aria-label="The world">
      <div className={styles.row}>
        <h2 className={styles.title}>The world</h2>
        <span className={styles.meta}>{worldLine(entryCount)}</span>
      </div>
    </section>
  );
}
