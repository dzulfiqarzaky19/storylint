"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { EntryWithDetails, Shelf, CategoryRow } from "@/domain/types";
import { categorySingular } from "@/domain/wiki/categoryLabels";
import { useInlineRename } from "@/hooks/useInlineRename";
import IndexRail from "@/components/shell/IndexRail";
import { Chevron, PencilIcon, TrashIcon } from "@/components/shell/RowIcons";
import { initialCollapse, resolveRename } from "../lib/shelfState";
import NewCategory from "../components/NewCategory";
import styles from "./Sidebar.module.css";

function catalogueLabel(entry: EntryWithDetails, index: number): string {
  const real = entry.catalogueNo?.trim();
  if (real && real !== "—") return real;
  return String(index + 1).padStart(2, "0");
}

function CategoryGroup({
  category,
  entries,
  collapsed,
  onToggle,
  selectedId,
  onSelect,
  onCreateEntry,
  onRenameCategory,
  onResetCategory,
  onRequestDeleteCategory,
  isRenamed,
  title,
}: {
  category: CategoryRow;
  entries: EntryWithDetails[];
  collapsed: boolean;
  onToggle: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
  onCreateEntry?: (shelf: Shelf, categoryId: string) => void;
  onRenameCategory: (categoryId: string, label: string) => void;
  onResetCategory: (categoryId: string) => void;
  onRequestDeleteCategory: (categoryId: string) => void;
  isRenamed: boolean;
  title: string;
}) {
  const rename = useInlineRename(title, {
    onCommit: (draft) => {
      const outcome = resolveRename(draft, title);
      if (outcome.action === "reset") onResetCategory(category.id);
      else if (outcome.action === "rename")
        onRenameCategory(category.id, outcome.label);
    },
  });

  const shelf = category.shelf as Shelf;
  const singular = categorySingular(title);

  return (
    <section className={styles.group}>
      <div className={styles.groupHead}>
        {rename.editing ? (
          <input
            className={styles.groupTitleInput}
            aria-label={`Rename ${title} category`}
            value={rename.draft}
            autoFocus
            onChange={(e) => rename.setDraft(e.target.value)}
            onBlur={rename.onBlur}
            onKeyDown={rename.onKeyDown}
          />
        ) : (
          <>
            <button
              type="button"
              className={`${styles.groupChevron}${collapsed ? "" : ` ${styles.chevronOpen}`}`}
              aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
              aria-expanded={!collapsed}
              onClick={onToggle}
            >
              <Chevron />
            </button>
            <button
              type="button"
              className={styles.groupTitle}
              aria-expanded={!collapsed}
              onClick={onToggle}
            >
              {title}
            </button>
            <span className={styles.groupCount}>{entries.length}</span>
            <span className={styles.groupTools}>
              <button
                type="button"
                className={styles.groupIcon}
                onClick={() => rename.start(title)}
                aria-label={`Rename ${title} category`}
                title={`Rename ${title} category`}
              >
                <PencilIcon />
              </button>
              {isRenamed ? (
                <button
                  type="button"
                  className={styles.groupReset}
                  onClick={() => onResetCategory(category.id)}
                  aria-label={`Reset ${title} category name`}
                >
                  Reset
                </button>
              ) : null}
              {category.isBuiltin ? null : (
                <button
                  type="button"
                  className={`${styles.groupIcon} ${styles.groupDelete}`}
                  onClick={() => onRequestDeleteCategory(category.id)}
                  aria-label={`Delete ${title} category`}
                  title={`Delete ${title} category`}
                >
                  <TrashIcon />
                </button>
              )}
            </span>
          </>
        )}
      </div>

      {!collapsed && (
        <ul className={styles.list}>
          {entries.map((e, i) => (
            <li key={e.id}>
              <button
                type="button"
                className={`${styles.item}${e.id === selectedId ? ` ${styles.itemActive}` : ""}`}
                aria-current={e.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(e.id)}
              >
                <span className={styles.itemNumber}>{catalogueLabel(e, i)}</span>
                <span className={styles.itemName}>{e.name}</span>
                {e.note ? (
                  <span className={styles.itemBadge}>{e.note}</span>
                ) : null}
              </button>
            </li>
          ))}
          {onCreateEntry ? (
            <li>
              <button
                type="button"
                className={styles.emptyAdd}
                onClick={() => onCreateEntry(shelf, category.id)}
              >
                + New {singular}
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

export interface SidebarProps {
  categories: CategoryRow[];
  byCategory: Map<string, EntryWithDetails[]>;
  selectedId: string;
  onSelect: (id: string) => void;
  total: number;
  onCreateEntry?: (shelf: Shelf, categoryId: string) => void;
  onCreateCategory: (id: string, label: string) => void;
  onRenameCategory: (categoryId: string, label: string) => void;
  onResetCategory: (categoryId: string) => void;
  onRequestDeleteCategory: (categoryId: string) => void;
  isRenamed: (categoryId: string) => boolean;
  labelFor: (categoryId: string) => string;
  footer?: ReactNode;
}

export default function Sidebar({
  categories,
  byCategory,
  selectedId,
  onSelect,
  total,
  onCreateEntry,
  onCreateCategory,
  onRenameCategory,
  onResetCategory,
  onRequestDeleteCategory,
  isRenamed,
  labelFor,
  footer,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    initialCollapse(categories.map((c) => c.id)),
  );
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return byCategory;
    const next = new Map<string, EntryWithDetails[]>();
    for (const [id, entries] of byCategory) {
      const hits = entries.filter((e) =>
        e.name.toLowerCase().includes(needle),
      );
      if (hits.length > 0) next.set(id, hits);
    }
    return next;
  }, [byCategory, needle]);

  const toggle = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const visible = needle
    ? categories.filter((c) => filtered.has(c.id))
    : categories;

  return (
    <IndexRail
      title="All entries"
      count={total}
      ariaLabel="The world"
      toggleLabel="Toggle entries"
      filter={{
        placeholder: "Filter entries…",
        value: query,
        onChange: setQuery,
      }}
      footer={footer}
    >
      {visible.map((cat) => (
        <CategoryGroup
          key={cat.id}
          category={cat}
          entries={filtered.get(cat.id) ?? []}
          collapsed={needle ? false : (collapsed[cat.id] ?? false)}
          onToggle={() => toggle(cat.id)}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreateEntry={needle ? undefined : onCreateEntry}
          onRenameCategory={onRenameCategory}
          onResetCategory={onResetCategory}
          onRequestDeleteCategory={onRequestDeleteCategory}
          isRenamed={isRenamed(cat.id)}
          title={labelFor(cat.id)}
        />
      ))}
      {needle && visible.length === 0 ? (
        <p className={styles.noResults}>No entries match &ldquo;{query}&rdquo;.</p>
      ) : null}
      {needle ? null : <NewCategory onCreate={onCreateCategory} />}
    </IndexRail>
  );
}
