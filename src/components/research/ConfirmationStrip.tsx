"use client";

import styles from "./ResearchScreen.module.css";

export interface ConfirmationStripProps {
  /** The pending card's title, interpolated into the sentence. */
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Appears ONLY when a card is pending. "Yes, write it in" is the sole wiki-write
 * trigger; "Cancel" writes nothing. Sentence copy is verbatim, curly quotes.
 * README §Screen 2.4 / HANDOFF §6.
 */
export default function ConfirmationStrip({
  title,
  onConfirm,
  onCancel,
}: ConfirmationStripProps) {
  return (
    <div className={styles.confirmStrip} role="group" aria-label="Confirm wiki write">
      <div className={styles.confirmSentence}>
        Add “{title}” to the wiki as a new entry? You can edit every word after.
      </div>
      <button type="button" className={styles.confirmYes} onClick={onConfirm}>
        Yes, write it in
      </button>
      <button type="button" className={styles.confirmCancel} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
