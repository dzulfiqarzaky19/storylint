"use client";

import { useEffect, useRef } from "react";
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

/**
 * Reusable confirmation dialog for irreversible actions. Purely presentational:
 * it owns no decision logic, it just renders the question and wires each button
 * to exactly one of the two callbacks the caller passes. The caller decides what
 * confirming means (soft-delete an entry, hard-delete a category, ...).
 *
 * Accessibility: a modal `role="dialog"` labelled by its title, focus moved to
 * the confirm button on open, Escape cancels. Buttons carry stable accessible
 * names so tests and assistive tech can target them without mystery selectors.
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
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog on open so keyboard + screen-reader users land on
  // the primary action, and Escape always cancels (never confirms).
  useEffect(() => {
    confirmRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className={styles.backdrop}
      // A click on the backdrop (outside the panel) cancels, matching Escape.
      onClick={onCancel}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        // Stop backdrop-cancel from firing when the click lands inside the panel.
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className={styles.title}>
          {title}
        </h2>
        {body ? <p className={styles.body}>{body}</p> : null}
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={danger ? styles.confirmDanger : styles.confirm}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
