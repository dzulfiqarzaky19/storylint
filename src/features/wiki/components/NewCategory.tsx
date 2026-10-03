"use client";

import { useId, useRef, useState } from "react";

import Modal from "@/components/ui/Modal";
import { resolveNewCategory } from "./newCategoryState";
import styles from "./NewCategory.module.css";

interface NewCategoryProps {
  onCreate: (id: string, label: string) => void;
  variant?: "panel" | "sidebar";
}

export default function NewCategory({
  onCreate,
  variant = "sidebar",
}: NewCategoryProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const titleId = useId();
  const idRef = useRef<string>("");

  const close = () => {
    setOpen(false);
    setLabel("");
  };

  const commit = () => {
    const outcome = resolveNewCategory(label, idRef.current);
    if (outcome.action === "create") {
      onCreate(outcome.id, outcome.label);
    }
    close();
  };

  return (
    <section className={styles.newShelf}>
      <button
        type="button"
        className={
          variant === "panel"
            ? `${styles.addButton} ${styles.addButtonPanel}`
            : styles.addButton
        }
        onClick={() => {
          idRef.current = crypto.randomUUID();
          setLabel("");
          setOpen(true);
        }}
      >
        {"+ New category"}
      </button>

      {open ? (
        <Modal open onClose={close} labelledBy={titleId}>
          <h2 id={titleId} className={styles.title}>
            New category
          </h2>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              commit();
            }}
          >
            <input
              className={styles.input}
              aria-label="New category name"
              placeholder="Category name"
              value={label}
              autoFocus
              onChange={(e) => setLabel(e.target.value)}
            />
            <div className={styles.actions}>
              <button type="submit" className={styles.commit}>
                Add
              </button>
              <button type="button" className={styles.cancel} onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
