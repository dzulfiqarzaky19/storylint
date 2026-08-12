"use client";

// Base Modal primitive (TCK-001). A slot-based dialog built on the native
// <dialog> element via showModal(), which gives the top layer, an inert
// background, and Escape-to-dismiss for free. On top of that we add an explicit
// focus TRAP (Tab / Shift-Tab cycle within the dialog, decided by the pure
// nextFocusIndex seam) and focus RESTORE (return focus to whatever was focused
// before the dialog opened). The default <dialog> chrome is fully reset in the
// CSS module so the panel reads as an Ashkeld surface (square corners, app
// scrim, tokened border), not the browser default.
//
// Purely presentational: it owns no business decision. onClose fires on Escape,
// a backdrop click, or the close affordance; the caller decides what closing
// means. Consumers (ConfirmModal, WorldSwitcher) migrate onto this in
// TCK-002 / TCK-003.

import { useCallback, useEffect, useRef } from "react";
import { nextFocusIndex } from "./focusTrap";
import styles from "./Modal.module.css";

export interface ModalProps {
  /** Whether the dialog is open. Toggling this drives showModal()/close(). */
  open: boolean;
  /**
   * Fired when the user asks to dismiss: Escape, a click on the backdrop, or a
   * close affordance the caller renders in the slot. The caller flips `open`.
   */
  onClose: () => void;
  /**
   * id of the element that labels the dialog (usually the title). Prefer this
   * over aria-label when a visible heading exists. One of labelledBy/ariaLabel
   * should be set so the dialog has an accessible name.
   */
  labelledBy?: string;
  /** Accessible name when there is no visible heading to point labelledBy at. */
  ariaLabel?: string;
  /** Dialog content. This is the slot: title, body, actions all live here. */
  children: React.ReactNode;
}

/** CSS selector for the elements a focus trap should cycle through. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(dialog: HTMLDialogElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export default function Modal({
  open,
  onClose,
  labelledBy,
  ariaLabel,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // The element focused before we opened, so we can restore focus on close.
  const restoreRef = useRef<HTMLElement | null>(null);

  // Open / close the native dialog in step with the `open` prop, and manage the
  // focus RESTORE side of the trap. showModal() puts the dialog in the top layer
  // and makes the rest of the page inert; close() tears that down.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        // Remember where focus was so we can return it when the dialog closes.
        restoreRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        dialog.showModal();
        // Move focus into the dialog (first focusable, else the dialog itself).
        const focusables = focusableIn(dialog);
        (focusables[0] ?? dialog).focus();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Restore focus to the pre-open element when the dialog goes away. Consumers
  // render this modal CONDITIONALLY (`{flag ? <Modal/> : null}`), so on close the
  // component UNMOUNTS with `open` still true — the closed state is never seen by
  // a mounted render. Restoring in the effect BODY (on an `!open` re-render) would
  // therefore never fire for those consumers and focus would strand on <body>
  // (WCAG 2.4.3 failure). Doing it in the effect CLEANUP instead runs it on both
  // the open->closed transition AND unmount, covering every consumer.
  //
  // The cleanup fires on ANY teardown of this effect, so it must not YANK focus
  // away from a still-open dialog or from an element the app deliberately focused.
  // Guard: only reclaim focus when it is currently orphaned — on <body> or still
  // inside the dialog that is going away — never when focus already moved to some
  // other real control.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    return () => {
      const toRestore = restoreRef.current;
      restoreRef.current = null;
      const active = document.activeElement;
      const orphaned =
        active === null ||
        active === document.body ||
        (dialog !== null && dialog.contains(active));
      if (orphaned && toRestore && document.contains(toRestore)) {
        toRestore.focus();
      }
    };
  }, [open]);

  // Native <dialog> fires `cancel` on Escape. Route it through onClose so the
  // caller (not the browser) decides dismissal, and so Escape and backdrop
  // click share one path.
  const onCancel = useCallback(
    (e: React.SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      onClose();
    },
    [onClose],
  );

  // A click on the dialog element itself (the ::backdrop area) is outside the
  // panel and dismisses; clicks inside the panel are stopped below.
  const onDialogClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose],
  );

  // Explicit Tab trap. <dialog showModal> keeps focus in the top layer in most
  // browsers, but we own the wraparound so focus provably cannot leave: on Tab
  // at the last element we go to the first, on Shift-Tab at the first we go to
  // the last (nextFocusIndex, unit-tested).
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = focusableIn(dialog);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const current = focusables.indexOf(document.activeElement as HTMLElement);
    const next = nextFocusIndex(focusables.length, current, e.shiftKey);
    e.preventDefault();
    focusables[next]?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      onCancel={onCancel}
      onClick={onDialogClick}
      onKeyDown={onKeyDown}
    >
      {/* The panel: clicks here must not bubble to the backdrop dismiss. */}
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </dialog>
  );
}
