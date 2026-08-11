"use client";

import { useRef, useState } from "react";

import styles from "./NewCategoryShelf.module.css";

interface NewCategoryShelfProps {
  /**
   * Create a category with `label`, keyed by the client `id` this component
   * mints once per form-open (blank label is a no-op). The stable id makes a
   * double-invoked commit idempotent server-side.
   *
   * TCK-009: no `shelf` argument — categories are all SIBLINGS (World >
   * Categories > Items) and the affordance no longer prompts for a shelf. The
   * NOT-NULL `categories.shelf` sort bucket is defaulted by the caller
   * (WikiScreen createCategoryOnShelf via defaultCategoryShelf()).
   */
  onCreate: (id: string, label: string) => void;
}

// F9-B S3 / TCK-009: the "+ New category" affordance rendered after the last
// category group. Collapsed to a single button; expands to an inline label
// input + Add/Cancel. Committing a non-blank label creates a top-level sibling
// category and collapses again. No shelf picker — a new category is a sibling
// of People/Places/Orders/Lore, not nested under one.
export default function NewCategoryShelf({ onCreate }: NewCategoryShelfProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  // TCK-010: mint the category id ONCE when the form opens and reuse it for
  // every commit of that open. A single click can invoke commit() twice; a
  // stable id collapses that to one row (server INSERT ON CONFLICT DO NOTHING),
  // while a genuinely new category (a fresh open) gets a fresh id below.
  const idRef = useRef<string>("");

  const commit = () => {
    const trimmed = label.trim();
    if (trimmed === "") {
      // Blank commit just collapses; nothing to create.
      setOpen(false);
      setLabel("");
      return;
    }
    onCreate(idRef.current, trimmed);
    setLabel("");
    setOpen(false);
  };

  if (!open) {
    return (
      <section className={styles.newShelf}>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => {
            idRef.current = crypto.randomUUID();
            setOpen(true);
          }}
        >
          {"+ New category"}
        </button>
      </section>
    );
  }

  return (
    <section className={styles.newShelf} aria-label="New category">
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
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              setLabel("");
            }
          }}
        />
        <button type="submit" className={styles.commit}>
          Add
        </button>
        <button
          type="button"
          className={styles.cancel}
          onClick={() => {
            setOpen(false);
            setLabel("");
          }}
        >
          Cancel
        </button>
      </form>
    </section>
  );
}
