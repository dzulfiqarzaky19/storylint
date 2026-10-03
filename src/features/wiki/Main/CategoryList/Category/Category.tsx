"use client";

import type { EntryWithDetails, Shelf as ShelfKey } from "@/domain/types";
import { useDrag } from "@/features/wiki/dnd/DragContext";
import { categorySingular } from "@/domain/wiki/categoryLabels";
import { useInlineRename } from "@/hooks/useInlineRename";
import { isEmptyCategory } from "../../../lib/shelfState";
import EntryTile from "./EntryTile";
import styles from "./Category.module.css";

interface CategoryProps {
  shelf: ShelfKey;
  categoryId: string;
  title: string;
  entries: EntryWithDetails[];
  selectedId: string;
  contradictions: Set<string>;
  onSelect: (id: string) => void;
  onDropEntry: (toShelf: ShelfKey, beforeId: string | null) => void;
  onDropFactOnEntry: (toEntryId: string) => void;
  onRenameCategory: (categoryId: string, label: string) => void;
  onResetCategory: (categoryId: string) => void;
  onRequestDeleteCategory: (categoryId: string) => void;
  onCreate?: (shelf: ShelfKey, categoryId: string) => void;
  isRenamed: boolean;
  isBuiltin: boolean;
}

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
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          if (drag.dropZone?.type === "shelf" && drag.dropZone.id === shelf) {
            drag.setZone(null);
          }
        }
      }}
      onDrop={(e) => {
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
          {isRenamed ? (
            <button
              type="button"
              className={styles.headerButton}
              onClick={() => onResetCategory(categoryId)}
            >
              Reset to default
            </button>
          ) : null}
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
