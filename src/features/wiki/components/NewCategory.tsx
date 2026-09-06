"use client";

import { useId, useRef, useState } from "react";

import Modal from "@/components/ui/Modal";
import { resolveNewCategory } from "./newCategoryState";
import styles from "./NewCategory.module.css";

interface NewCategoryProps {
  /**
   * Create a category with `label`, keyed by the client `id` this component
   * mints once per popup-open (blank label is a no-op). The stable id makes a
   * double-invoked commit idempotent server-side.
   *
   * TCK-009: no `shelf` argument — categories are all SIBLINGS (World >
   * Categories > Items) and the affordance no longer prompts for a shelf. The
   * NOT-NULL `categories.shelf` sort bucket is defaulted by the caller
   * (Wiki createCategoryOnShelf via defaultCategoryShelf()).
   */
  onCreate: (id: string, label: string) => void;
  /**
   * Where the trigger is rendered. The main "panel" insets the trigger by the
   * shared gutter so "+ New category" lines up with the gutter-padded Category
   * blocks above it; the "sidebar" (default) sits flush like the other flat
   * "+ New …" create rows. The popup itself is identical either way.
   */
  variant?: "panel" | "sidebar";
}

// F9-B S3 / TCK-009 / TCK-019: the "+ New category" affordance rendered after
// the last category group, shared by BOTH the main shelf and the sidebar
// (Sidebar). TCK-019 replaced the old inline-expand form with a POPUP: the
// trigger is a flat "+ New category" button (matching "+ New thread"/"+ New
// chapter"); clicking it mints the category id once and opens a labelled
// <Modal> with a name input + Add/Cancel. Committing a non-blank label creates
// a top-level sibling category and closes the popup; Cancel / Escape / backdrop
// close it without creating; the base Modal restores focus to the trigger. No
// shelf picker — a new category is a sibling of People/Places/Orders/Lore.
export default function NewCategory({
  onCreate,
  variant = "sidebar",
}: NewCategoryProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const titleId = useId();
  // TCK-010: mint the category id ONCE when the popup opens and reuse it for
  // every commit of that open. A single click can invoke commit() twice; a
  // stable id collapses that to one row (server INSERT ON CONFLICT DO NOTHING),
  // while a genuinely new category (a fresh open) gets a fresh id below.
  const idRef = useRef<string>("");

  const close = () => {
    setOpen(false);
    setLabel("");
  };

  const commit = () => {
    // TCK-019: the decision (blank=noop / non-blank=create-with-minted-id) lives
    // in the pure resolveNewCategory helper so it is unit-mutation-proved; this
    // handler just dispatches its outcome and closes.
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
