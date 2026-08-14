"use client";

import { useRef, useState } from "react";
import Modal from "./Modal";
import { createOneShot } from "./oneShot";
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
  /**
   * Optional: the caller is mid-flight on a previous confirm (e.g. an async
   * delete is awaiting). When true the confirm button reads as busy and is
   * disabled. This is the CALLER's own busy signal; it is independent of the
   * internal one-shot guard, which fires onConfirm exactly once per open even
   * if the caller passes no `pending`. Defaults to false (fully back-compat).
   */
  pending?: boolean;
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
  pending = false,
}: ConfirmModalProps) {
  // One-shot double-submit guard. A destructive confirm whose onConfirm is async
  // (e.g. WorldSwitcher's delete: setBusy -> await -> unmount AFTER the await)
  // has a real window where a fast SECOND click fires onConfirm twice before the
  // modal unmounts. The latch (createOneShot) lets the first click through and
  // swallows the rest; `submitted` mirrors it into render state so the button can
  // disable + read as busy after the first click (the ref alone would not trigger
  // a re-render).
  //
  // Per-open guarantee (structural): ConfirmModal has no `open` prop — it always
  // renders `<Modal open>` while mounted, and every caller renders it
  // CONDITIONALLY (`{flag ? <ConfirmModal/> : null}`), so a fresh open is always a
  // fresh MOUNT with a fresh, armed `createOneShot()` and `submitted === false`.
  // The guard is therefore inherently per-open, not per-lifetime: a legitimate
  // later delete opens a new modal that fires again. The seam's re-arm path
  // (createOneShot().reset) is unit-tested directly (oneShot.test.ts).
  const shotRef = useRef(createOneShot());
  const [submitted, setSubmitted] = useState(false);

  const handleConfirm = () => {
    shotRef.current.fire(() => {
      setSubmitted(true);
      onConfirm();
    });
  };

  // Busy when the caller says so OR once we've already fired this open.
  const busy = pending || submitted;

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
          onClick={handleConfirm}
          disabled={busy}
          aria-disabled={busy || undefined}
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
