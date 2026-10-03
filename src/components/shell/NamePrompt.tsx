import { useRef, useState } from "react";
import { canSubmitName } from "@/domain/nameGate";
import Modal from "../ui/Modal";
import styles from "./SwitcherMenu.module.css";

export default function NamePrompt({
  title,
  initial = "",
  confirmLabel = "Create",
  onSubmit,
  onCancel,
}: {
  title: string;
  initial?: string;
  confirmLabel?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const submittable = canSubmitName(value);
  // Enter and the button can both fire before the modal closes; submit once.
  const submittingRef = useRef(false);

  const submit = () => {
    if (submittingRef.current) return;
    if (!canSubmitName(value)) return;
    submittingRef.current = true;
    onSubmit(value.trim());
  };

  return (
    <Modal open onClose={onCancel} ariaLabel={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2 className={styles.promptTitle}>{title}</h2>
        <input
          className={styles.promptInput}
          type="text"
          aria-label={title}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <div className={styles.promptActions}>
          <button type="button" className={styles.promptCancel} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.promptConfirm} disabled={!submittable}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
