"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { EntryWithDetails, Shelf, CategoryRow } from "@/lib/domain/types";
import { categorySingular } from "@/lib/wiki/categoryLabels";
import { useInlineRename } from "@/components/hooks/useInlineRename";
import IndexRail from "@/components/shell/IndexRail";
import { Chevron, PencilIcon, TrashIcon } from "@/components/shell/RowIcons";
import { initialCollapse, resolveRename } from "../lib/shelfState";
import NewCategory from "../components/NewCategory";
import styles from "./Sidebar.module.css";

/** The rail's per-row number. Real `catalogueNo` wins; entries whose row has
 *  never been assigned one (the importer writes "" or "—") fall back to their
 *  1-based position within the group, which is what the prototype shows. */
function catalogueLabel(entry: EntryWithDetails, index: number): string {
  const real = entry.catalogueNo?.trim();
  if (real && real !== "—") return real;
  return String(index + 1).padStart(2, "0");
}

/** A rail row shows a flag dot when any chapter appearance carries a flag —
 *  the entry-level rollup of the same signal the Timeline tab renders per row. */
function isFlagged(entry: EntryWithDetails): boolean {
  return entry.appearances.some((a) => a.flag !== null);
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
      // A blank draft is a reset (matches the reducer/backend trim ruling); a
      // non-blank change renames. resolveRename (shelfState.ts) owns that pure
      // decision so it stays unit-tested in the node env; this just dispatches.
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
            {/* The title text ALSO collapses the group. Renaming moved OFF the
                title and onto the explicit Rename button beside it — a click on
                a category name should open it, not enter an edit box. */}
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
              {/* Built-ins are not deletable (is_builtin invariant), so the
                  control is absent rather than disabled for them. */}
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
                className={`${styles.item}${e.id === selectedId ? ` ${styles.itemActive}` : ""}${isFlagged(e) ? ` ${styles.itemFlag}` : ""}`}
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
  /** F9-B / TCK-005: the FULL live category list (built-in + user), in the
   *  reducer's sorted order — the SAME source the main shelf maps. Drives one
   *  collapsible group per category, so user categories (Guilds/Doomed) and
   *  empty categories all appear, matching the main column. */
  categories: CategoryRow[];
  /** Entries bucketed by CATEGORY id (built-in Kind string or user UUID),
   *  preserving each shelf's live order. Same map the main shelf consumes. */
  byCategory: Map<string, EntryWithDetails[]>;
  selectedId: string;
  onSelect: (id: string) => void;
  /** Total entry count for the rail head ("· N"). */
  total: number;
  /** Start authoring a new ENTRY under the given category's shelf (per-group
   *  "+ New <singular>" affordance; same create path the main shelf uses). */
  onCreateEntry?: (shelf: Shelf, categoryId: string) => void;
  /** Create a new CATEGORY (bottom "+ New category" affordance). Mirrors the
   *  main CategoryList's NewCategory create path so both columns stay in sync. */
  onCreateCategory: (id: string, label: string) => void;
  /** Rename a category's header to a custom label. */
  onRenameCategory: (categoryId: string, label: string) => void;
  /** Clear a custom label, restoring the built-in shelf default. */
  onResetCategory: (categoryId: string) => void;
  /** Ask to delete the whole category (opens the danger confirm in the caller). */
  onRequestDeleteCategory: (categoryId: string) => void;
  /** True when a category has a custom label set, so "Reset" is offered. */
  isRenamed: (categoryId: string) => boolean;
  /** Resolved header label for a category id (built-in default or custom). */
  labelFor: (categoryId: string) => string;
  /** Optional slot rendered at the BOTTOM of the sidebar panel (F6-S6b trash). */
  footer?: ReactNode;
}

/**
 * The Wiki LEFT index rail contents — one collapsible group per category, in
 * full parity with the main shelf (built-in + user categories, including empty
 * ones).
 *
 * All rail CHROME (head, filter + "/" hotkey, scroll containment, the <=1200px
 * fold, ARIA, viewport widths) belongs to the shared `IndexRail`; this module
 * owns only the wiki's own list. See CONTEXT.md → Chrome → index rail.
 */
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
  // Per-category collapse, id-keyed. Seeded from the initial category ids (all
  // expanded); a category created later is absent from the map, so `collapsed[id]`
  // is undefined -> falsy -> expanded, which is the intended default.
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

  // While filtering, a category is shown only if it still has a hit, and it is
  // force-expanded — a collapsed group would hide the match the writer typed for.
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
