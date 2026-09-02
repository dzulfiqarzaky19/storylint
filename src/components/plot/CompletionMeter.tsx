"use client";

import type { PlotProgression } from "@/lib/db/plot";
import styles from "./PlotScreen.module.css";

export function CompletionMeter({
  completion,
}: {
  completion: PlotProgression["completion"];
}) {
  const { resolved, owed, percent } = completion;
  const tail = owed > 0 && resolved === owed ? " \u00b7 all arcs landed" : "";
  return (
    <div className={styles.meter} aria-live="polite">
      <span className={styles.meterBar}>
        <i style={{ width: `${percent}%` }} />
      </span>
      <span>
        <b>
          {resolved} of {owed}
        </b>{" "}
        arcs landed{tail}
      </span>
    </div>
  );
}
