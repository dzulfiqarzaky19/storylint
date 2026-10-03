"use client";

import { useCallback, useEffect, useRef } from "react";
import { nextFocusIndex } from "./focusTrap";
import styles from "./Modal.module.css";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

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
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        restoreRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        dialog.showModal();
        const focusables = focusableIn(dialog);
        (focusables[0] ?? dialog).focus();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

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

  const onCancel = useCallback(
    (e: React.SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      onClose();
    },
    [onClose],
  );

  const onDialogClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose],
  );

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
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </dialog>
  );
}
