"use client";

import styles from "../Thread.module.css";

export interface PromptChipProps {
  label: string;
  onClick: () => void;
}

export default function PromptChip({ label, onClick }: PromptChipProps) {
  return (
    <button type="button" className={styles.chip} onClick={onClick}>
      {label}
    </button>
  );
}
