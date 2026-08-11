"use client";

import Modal from "./Modal";
import styles from "./ConfirmModal.module.css";

export interface ConfirmModalProps {
  /** Short question shown as the dialog heading, e.g. "Delete Maren?". */
  title: string;
  /** Optional supporting line under the title (consequence of confirming). */
  body?: string;
  /** Accessible + visible label on the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Accessible + visible label on the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /**
   * Style the confirm button as a destructive action (red). Use for deletes and
   * other irreversible operations so the danger reads at a glance.
   */
  danger?: boolean;
  /** Fired ONLY by the confirm button (and never by cancel/dismiss). */
  onConfirm: () => void;
  /** Fired by the cancel button, the Escape key, or a backdrop click. */
  onCancel: () => void;
}

/** Stable id linking the dialog to its heading for aria-labelledby. */
const TITLE_ID = "confirm-modal-title";

/**
 * Reusable confirmation dialog for irreversible actions. A THIN wrapper over the
 * base <Modal> primitive: Modal owns the <dialog>, the focus trap + restore,
 * Escape, and backdrop-click; ConfirmModal just fills the slot with the question
 * and two buttons and maps every dismissal (Escape / backdrop / Cancel) to
 * onCancel. Purely presentational: it owns no decision. The caller decides what
 * confirming means (soft-delete an entry, hard-delete a category, ...).
 *
 * Focus: Modal moves focus to the FIRST focusable in the slot on open, so the
 * confirm button is rendered first in the DOM (and visually re-ordered to the
 * right by CSS) — this preserves the previous "focus lands on confirm" behavior
 * while keeping the Cancel-left / Confirm-right layout.
 */
export default function ConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal open onClose={onCancel} labelledBy={TITLE_ID}>
      <h2 id={TITLE_ID} className={styles.title}>
        {title}
      </h2>
      {body ? <p className={styles.body}>{body}</p> : null}
      <div className={styles.actions}>
        {/* Confirm is FIRST in the DOM so Modal focuses it on open; CSS reverses
            the visual order so Cancel still reads on the left. */}
        <button
          type="button"
          className={danger ? styles.confirmDanger : styles.confirm}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </Modal>
  );
}
