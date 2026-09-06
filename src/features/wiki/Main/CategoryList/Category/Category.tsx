"use client";

import type { EntryWithDetails, Shelf as ShelfKey } from "@/lib/domain/types";
import { useDrag } from "@/components/dnd/DragContext";
import { categorySingular } from "@/lib/wiki/categoryLabels";
import { useInlineRename } from "@/components/hooks/useInlineRename";
import { isEmptyCategory } from "../../../lib/shelfState";
import EntryTile from "./EntryTile";
import styles from "./Category.module.css";

interface CategoryProps {
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
  /** Start authoring a new entry on this shelf (TCK-006; same path as sidebar). */
  onCreate?: (shelf: ShelfKey, categoryId: string) => void;
  /** True when a custom label is set, so the "Reset" affordance is offered. */
  isRenamed: boolean;
  /** True for the 4 seeded categories, which cannot be deleted (TCK-007): the
   *  trash icon is hidden so the is_builtin invariant is honored in the UI. */
  isBuiltin: boolean;
}

// One shelf group — heading row then wrapping tiles (README Screen 1 "Shelves").
// The shelf itself is a drop zone: dropping a tile on the empty space APPENDS it
// here and REGROUPS it (changes its kind/shelf). Zone fills --hover while active.
export default function Category({
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
  onCreate,
  isRenamed,
  isBuiltin,
}: CategoryProps) {
  const drag = useDrag();
  const dragging = drag.dragging;

  // Inline rename draft (T-ARCH-7: shared useInlineRename hook — see its
  // header for the dedup boundary). Shelf keeps its OWN commit decision: a
  // blank draft resets to the built-in default (matches the reducer/backend
  // trim ruling), a changed draft renames, an unchanged draft is a no-op.
  const rename = useInlineRename(title, {
    onCommit: (draft) => {
      if (draft.trim() === "") onResetCategory(categoryId);
      else if (draft.trim() !== title) onRenameCategory(categoryId, draft);
    },
  });

  const isZoneActive =
    dragging?.type === "entry" &&
    drag.dropZone?.type === "shelf" &&
    drag.dropZone.id === shelf;

  // A category with no entries reads lighter (dimmed heading + a real-text
  // hint) but keeps its edit/reset/delete controls so the user can still remove
  // it. Same predicate the unit test exercises, so a regression moves the UI too.
  const isEmpty = isEmptyCategory(entries.length);

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
      <div className={`${styles.heading} ${isEmpty ? styles.headingEmpty : ""}`}>
        {rename.editing ? (
          <input
            className={styles.titleInput}
            aria-label={`Rename ${title} category`}
            value={rename.draft}
            autoFocus
            onChange={(e) => rename.setDraft(e.target.value)}
            onBlur={rename.onBlur}
            onKeyDown={rename.onKeyDown}
          />
        ) : (
          // TCK-007: the title itself is the rename affordance — click it to edit
          // inline (the separate "Rename" button is gone). A real <button> keeps
          // it keyboard-focusable and screen-reader-announced as an action.
          <button
            type="button"
            className={styles.title}
            aria-label={`Rename ${title} category`}
            onClick={() => rename.start(title)}
          >
            {title}
          </button>
        )}
        <span className={styles.count}>{entries.length}</span>
        <div className={styles.headerActions}>
          {/* Reset-to-default stays reachable for a renamed built-in (TCK-007
              folded it out of the dropped ⋯ menu into the icon row). */}
          {isRenamed ? (
            <button
              type="button"
              className={styles.headerButton}
              onClick={() => onResetCategory(categoryId)}
            >
              Reset to default
            </button>
          ) : null}
          {/* TCK-007: a direct trash icon replaces the ⋯ menu's "Delete category".
              It still opens the danger ConfirmModal in the caller. Built-ins are
              not deletable (is_builtin invariant), so the icon is hidden for them. */}
          {isBuiltin ? null : (
            <button
              type="button"
              className={styles.deleteIcon}
              aria-label={`Delete ${title} category`}
              title={`Delete ${title} category`}
              onClick={() => onRequestDeleteCategory(categoryId)}
            >
              {"\u{1F5D1}"}
            </button>
          )}
        </div>
        <span className={styles.line} aria-hidden="true" />
      </div>
      <div className={styles.tiles}>
        {isEmpty ? (
          <p className={styles.emptyHint} role="note">
            No entries yet
          </p>
        ) : (
          entries.map((entry) => (
            <EntryTile
              key={entry.id}
              entry={entry}
              selected={entry.id === selectedId}
              hasContradiction={contradictions.has(entry.id)}
              onSelect={onSelect}
              onDropEntry={onDropEntry}
              onDropFactOnEntry={onDropFactOnEntry}
            />
          ))
        )}
        {/* TCK-006: add-entry affordance on the MAIN shelf, mirroring the
            sidebar's "+ New <singular>" (Sidebar). Same create path via
            onCreate(shelf); the singular label routes through the shared
            categorySingular seam so both surfaces agree. */}
        {onCreate ? (
          <button
            type="button"
            className={styles.addEntry}
            onClick={() => onCreate(shelf, categoryId)}
          >
            + Add new {categorySingular(title)}
          </button>
        ) : null}
      </div>
    </section>
  );
}
