"use client";

import { useState } from "react";
import type { EntryWithDetails, Shelf as ShelfKey } from "@/lib/domain/types";
import { useDrag } from "@/components/dnd/DragContext";
import EntryTile from "./EntryTile";
import styles from "./Shelf.module.css";

interface ShelfProps {
  shelf: ShelfKey;
  /** F9-B S3: the id of the category this group renders (built-in Kind string
   *  or a user UUID). Header rename/reset/delete act on THIS id, not the shelf. */
  categoryId: string;
  title: string;
  entries: EntryWithDetails[];
  selectedId: string;
  /** Entry ids the check engine flags with an unresolved contradiction. */
  contradictions: Set<string>;
  onSelect: (id: string) => void;
  /** Reorder within/across shelves; beforeId=null means append to this shelf. */
  onDropEntry: (toShelf: ShelfKey, beforeId: string | null) => void;
  onDropFactOnEntry: (toEntryId: string) => void;
  /** Rename this category's header to a custom label (F6-S5; F9-B S3: any id). */
  onRenameCategory: (categoryId: string, label: string) => void;
  /** Clear the custom label, restoring the shelf default (F6-S5; built-ins only). */
  onResetCategory: (categoryId: string) => void;
  /** Ask to delete the whole category (opens the danger confirm in the caller). */
  onRequestDeleteCategory: (categoryId: string) => void;
  /** True when a custom label is set, so the "Reset" affordance is offered. */
  isRenamed: boolean;
}

// One shelf group — heading row then wrapping tiles (README Screen 1 "Shelves").
// The shelf itself is a drop zone: dropping a tile on the empty space APPENDS it
// here and REGROUPS it (changes its kind/shelf). Zone fills --hover while active.
export default function Shelf({
  shelf,
  categoryId,
  title,
  entries,
  selectedId,
  contradictions,
  onSelect,
  onDropEntry,
  onDropFactOnEntry,
  onRenameCategory,
  onResetCategory,
  onRequestDeleteCategory,
  isRenamed,
}: ShelfProps) {
  const drag = useDrag();
  const dragging = drag.dragging;

  // Inline rename + a small header menu (reset / delete). `editing` holds the
  // draft label; `menuOpen` toggles the reset/delete affordances. Both are
  // purely local view state — the committed label lives in the reducer.
  const [editing, setEditing] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const commitRename = () => {
    if (editing === null) return;
    const draft = editing;
    setEditing(null);
    // A blank draft is a reset (matches the reducer/backend trim ruling).
    if (draft.trim() === "") onResetCategory(categoryId);
    else if (draft.trim() !== title) onRenameCategory(categoryId, draft);
  };

  const isZoneActive =
    dragging?.type === "entry" &&
    drag.dropZone?.type === "shelf" &&
    drag.dropZone.id === shelf;

  return (
    <section
      className={`${styles.shelf} ${isZoneActive ? styles.zoneActive : ""}`}
      aria-label={title}
      onDragOver={(e) => {
        if (dragging?.type !== "entry") return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        drag.setZone({ type: "shelf", id: shelf });
      }}
      onDragLeave={(e) => {
        // Only clear when the pointer truly leaves the shelf, not a child tile.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          if (drag.dropZone?.type === "shelf" && drag.dropZone.id === shelf) {
            drag.setZone(null);
          }
        }
      }}
      onDrop={(e) => {
        // A tile dropped on a tile is handled by the tile (insert-before); this
        // fires only for the shelf's empty space → append + regroup.
        e.preventDefault();
        if (dragging?.type === "entry") onDropEntry(shelf, null);
        drag.endDrag();
      }}
    >
      <div className={styles.heading}>
        {editing !== null ? (
          <input
            className={styles.titleInput}
            aria-label={`Rename ${title} category`}
            value={editing}
            autoFocus
            onChange={(e) => setEditing(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setEditing(null);
              }
            }}
          />
        ) : (
          <h2 className={styles.title}>{title}</h2>
        )}
        <span className={styles.count}>{entries.length}</span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerButton}
            aria-label={`Rename ${title} category`}
            onClick={() => {
              setMenuOpen(false);
              setEditing(title);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className={styles.headerButton}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`${title} category options`}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {"\u22EF"}
          </button>
          {menuOpen ? (
            <div className={styles.menu} role="menu">
              {isRenamed ? (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => {
                    setMenuOpen(false);
                    onResetCategory(categoryId);
                  }}
                >
                  Reset to default
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={() => {
                  setMenuOpen(false);
                  onRequestDeleteCategory(categoryId);
                }}
              >
                Delete category
              </button>
            </div>
          ) : null}
        </div>
        <span className={styles.line} aria-hidden="true" />
      </div>
      <div className={styles.tiles}>
        {entries.map((entry) => (
          <EntryTile
            key={entry.id}
            entry={entry}
            selected={entry.id === selectedId}
            hasContradiction={contradictions.has(entry.id)}
            onSelect={onSelect}
            onDropEntry={onDropEntry}
            onDropFactOnEntry={onDropFactOnEntry}
          />
        ))}
      </div>
    </section>
  );
}
