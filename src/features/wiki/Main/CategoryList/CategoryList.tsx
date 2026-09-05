"use client";

import type { CategoryRow, EntryWithDetails, Shelf as ShelfKey } from "@/lib/domain/types";
import NewCategory from "../../components/NewCategory";
import World from "./World";
import Category from "./Category/Category";
import styles from "./CategoryList.module.css";

interface CategoryListProps {
  categories: CategoryRow[];
  byCategory: Map<string, EntryWithDetails[]>;
  selectedId: string;
  contradictions: Set<string>;
  entryCount: number;
  onSelect: (id: string) => void;
  onDropEntry: (toShelf: ShelfKey, beforeId: string | null) => void;
  onDropFactOnEntry: (toEntryId: string) => void;
  onRenameCategory: (categoryId: string, label: string) => void;
  onResetCategory: (categoryId: string) => void;
  onRequestDeleteCategory: (categoryId: string) => void;
  onCreate: (shelf: ShelfKey, categoryId: string) => void;
  onCreateCategory: (id: string, label: string) => void;
  isRenamed: (categoryId: string) => boolean;
  isBuiltin: (categoryId: string) => boolean;
  titleFor: (categoryId: string) => string;
}

export default function CategoryList({
  categories,
  byCategory,
  selectedId,
  contradictions,
  entryCount,
  onSelect,
  onDropEntry,
  onDropFactOnEntry,
  onRenameCategory,
  onResetCategory,
  onRequestDeleteCategory,
  onCreate,
  onCreateCategory,
  isRenamed,
  isBuiltin,
  titleFor,
}: CategoryListProps) {
  return (
    <>
      <World entryCount={entryCount} />
      <div className={styles.shelves}>
        {categories.map((cat) => (
          <Category
            key={cat.id}
            shelf={cat.shelf as ShelfKey}
            categoryId={cat.id}
            title={titleFor(cat.id)}
            entries={byCategory.get(cat.id) ?? []}
            selectedId={selectedId}
            contradictions={contradictions}
            onSelect={onSelect}
            onDropEntry={onDropEntry}
            onDropFactOnEntry={onDropFactOnEntry}
            onRenameCategory={onRenameCategory}
            onResetCategory={onResetCategory}
            onRequestDeleteCategory={onRequestDeleteCategory}
            onCreate={onCreate}
            isRenamed={isRenamed(cat.id)}
            isBuiltin={isBuiltin(cat.id)}
          />
        ))}
        <NewCategory variant="panel" onCreate={onCreateCategory} />
      </div>
    </>
  );
}
