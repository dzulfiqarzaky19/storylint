"use client";

import styles from "./ResearchScreen.module.css";

export interface PromptChipProps {
  label: string;
  onClick: () => void;
}

/**
 * A canned prompt chip. Clicking advances the thread by revealing the deferred
 * `more` turns ( — real prompt sending needs the AI layer, out of
 * scope). README §Screen 2.5.
 */
export default function PromptChip({ label, onClick }: PromptChipProps) {
  return (
    <button type="button" className={styles.chip} onClick={onClick}>
      {label}
    </button>
  );
}
