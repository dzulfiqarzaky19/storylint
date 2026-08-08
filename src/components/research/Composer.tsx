"use client";

import type { ReactNode } from "react";
import styles from "./ResearchScreen.module.css";

export interface ComposerProps {
  /** The prompt chip row (rendered by the screen so chips carry handlers). */
  children: ReactNode;
}

/**
 * Left side of the footer. The placeholder is rendered as static 24px/700 faint
 * text (the prototype has no real input); below it, the prompt chip row.
 * README §Screen 2.5. Placeholder copy is verbatim.
 */
export default function Composer({ children }: ComposerProps) {
  return (
    <div className={styles.composer}>
      <div className={styles.composerPlaceholder}>
        Type anything. Half a thought is enough.
      </div>
      <div className={styles.chips}>{children}</div>
    </div>
  );
}
