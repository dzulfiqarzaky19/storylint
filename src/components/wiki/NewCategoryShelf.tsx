"use client";

import { useRef, useState } from "react";
import type { Shelf as ShelfKey } from "@/lib/domain/types";
import { SHELF_TITLES } from "@/lib/domain/types";
import styles from "./NewCategoryShelf.module.css";

// The 4 built-in shelves a new user category can be filed under. A category is
// grouped in the UI by its own id, but it still belongs to ONE shelf (which
// drives its default sort bucket + the WikiIndex grouping), so creation must
// pick one. Order matches SHELF_ORDER in WikiScreen.
const SHELVES: ShelfKey[] = ["people", "places", "orders", "lore"];

interface NewCategoryShelfProps {
  /**
   * Create a category with `label` filed under `shelf`, keyed by the client
   * `id` this component mints once per form-open (blank label is a no-op). The
   * stable id makes a double-invoked commit idempotent server-side.
   */
  onCreate: (id: string, label: string, shelf: ShelfKey) => void;
}

// F9-B S3: the "+ New category" affordance rendered after the last category
// group. Collapsed to a single button; expands to an inline label input + shelf
// picker. Committing a non-blank label creates the category and collapses again.
export default function NewCategoryShelf({ onCreate }: NewCategoryShelfProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [shelf, setShelf] = useState<ShelfKey>("people");
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
    onCreate(idRef.current, trimmed, shelf);
    setLabel("");
    setShelf("people");
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
        <select
          className={styles.select}
          aria-label="New category shelf"
          value={shelf}
          onChange={(e) => setShelf(e.target.value as ShelfKey)}
        >
          {SHELVES.map((s) => (
            <option key={s} value={s}>
              {SHELF_TITLES[s]}
            </option>
          ))}
        </select>
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
