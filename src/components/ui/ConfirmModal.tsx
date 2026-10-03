"use client";

import { useRef, useState } from "react";
import Modal from "./Modal";
import { createOneShot } from "./oneShot";
import { matchesDeleteName } from "./confirmNameGate";
import styles from "./ConfirmModal.module.css";

export interface ConfirmModalProps {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  requireTypeToConfirm?: string;
}

const TITLE_ID = "confirm-modal-title";

export default function ConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
  pending = false,
  requireTypeToConfirm,
}: ConfirmModalProps) {
  const shotRef = useRef(createOneShot());
  const [submitted, setSubmitted] = useState(false);
  const [typed, setTyped] = useState("");
  const typedGateOk =
    requireTypeToConfirm === undefined || matchesDeleteName(typed, requireTypeToConfirm);

  const handleConfirm = () => {
    if (!typedGateOk) return;
    shotRef.current.fire(() => {
      setSubmitted(true);
      onConfirm();
    });
  };

  const busy = pending || submitted;
  const confirmDisabled = busy || !typedGateOk;

  return (
    <Modal open onClose={onCancel} labelledBy={TITLE_ID}>
      <h2 id={TITLE_ID} className={styles.title}>
        {title}
      </h2>
      {body ? <p className={styles.body}>{body}</p> : null}
      {requireTypeToConfirm !== undefined ? (
        <label className={styles.typeGate}>
          <span className={styles.typeGateHint}>
            Type <strong>{requireTypeToConfirm}</strong> to confirm
          </span>
          <input
            className={styles.typeGateInput}
            type="text"
            autoComplete="off"
            aria-label={`Type ${requireTypeToConfirm} to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
      ) : null}
      <div className={styles.actions}>
        <button
          type="button"
          className={danger ? styles.confirmDanger : styles.confirm}
          onClick={handleConfirm}
          disabled={confirmDisabled}
          aria-disabled={confirmDisabled || undefined}
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
