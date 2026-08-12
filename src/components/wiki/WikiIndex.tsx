"use client";

import { useId, useState, type ReactNode } from "react";
import type { EntryWithDetails, Shelf, CategoryRow } from "@/lib/domain/types";
import { categorySingular } from "@/lib/wiki/categoryLabels";
import { initialCollapse, resolveRename } from "./shelfState";
import NewCategoryShelf from "./NewCategoryShelf";
import styles from "./WikiIndex.module.css";

/** TCK-020: disclosure chevron. A single right-pointing SVG glyph; direction is
 *  driven by CSS (the caller adds an "open" modifier that rotates it 90deg to
 *  point down). Crisp at any font, unlike the old +/- and U+2304 text glyphs.
 *  Decorative only — the expand/collapse state lives on aria-expanded. */
function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <polyline points="6 4 10 8 6 12" />
    </svg>
  );
}

export interface WikiIndexProps {
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
  /** Total entry count for the header ("N entries"). */
  total: number;
  /** Start authoring a new ENTRY under the given category's shelf (per-group
   *  "+ New <singular>" affordance; same create path the main shelf uses). */
  onCreateEntry?: (shelf: Shelf) => void;
  /** Create a new CATEGORY (bottom "+ New category" affordance). Mirrors the
   *  main shelf's NewCategoryShelf create path so both columns stay in sync. */
  onCreateCategory: (id: string, label: string) => void;
  /** Rename a category's header to a custom label (click-the-name inline). */
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
 * The Wiki LEFT sidebar — "The world" grouped index. TCK-005: brought to FULL
 * PARITY with the main shelf. It now renders EVERY category from `categories`
 * (built-in + user, including empty ones) as its own collapsible group instead
 * of the old hardcoded 4 shelves, so a user category (Guilds/Doomed) or a
 * newly-created one appears here exactly as it does in the main column.
 *
 * Per-category controls mirror the main Shelf header (TCK-007): click the name
 * to rename inline, a trash icon to delete (hidden for built-ins, which are not
 * deletable), a "+ New <singular>" to author an entry, plus a bottom
 * "+ New category" affordance sharing the main shelf's create path.
 *
 * Standing full-height column on desktop. On the stacked tier (<=1200px) the
 * whole index folds behind a header TOGGLE; `open` only affects that tier.
 */
export default function WikiIndex({
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
}: WikiIndexProps) {
  // Per-category collapse, id-keyed. Seeded from the initial category ids (all
  // expanded); a category created later is absent from the map, so `collapsed[id]`
  // is undefined -> falsy -> expanded, which is the intended default.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    initialCollapse(categories.map((c) => c.id)),
  );
  // Inline rename draft, keyed by category id; null means no group is editing.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Whole-index collapse for the stacked tier. Closed by default so mobile
  // opens on the entry; the toggle is hidden on desktop where it's always open.
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const toggle = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const startRename = (id: string, current: string) => {
    setEditing(id);
    setDraft(current);
  };

  const commitRename = (id: string, title: string) => {
    if (editing !== id) return;
    const value = draft;
    setEditing(null);
    // A blank draft is a reset (matches the reducer/backend trim ruling); a
    // non-blank change renames. resolveRename (shelfState.ts) owns that pure
    // decision so it stays unit-tested in the node env; this just dispatches.
    const outcome = resolveRename(value, title);
    if (outcome.action === "reset") onResetCategory(id);
    else if (outcome.action === "rename") onRenameCategory(id, outcome.label);
  };

  return (
    <nav
      className={`${styles.index} ${open ? styles.indexOpen : ""}`}
      aria-label="The world"
    >
      <button
        type="button"
        className={styles.railToggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.title}>The world</span>
        <span className={styles.count}>{total} entries</span>
        <span
          className={`${styles.railToggleChevron}${open ? ` ${styles.chevronOpen}` : ""}`}
          aria-hidden="true"
        >
          <Chevron />
        </span>
      </button>

      <div id={panelId} className={styles.panel}>
        {categories.map((cat) => {
          const entries = byCategory.get(cat.id) ?? [];
          const isCollapsed = collapsed[cat.id] ?? false;
          const title = labelFor(cat.id);
          const shelf = cat.shelf as Shelf;
          return (
            <section key={cat.id} className={styles.group}>
              {/* TCK-018: ONE consolidated control cluster per category. The
                  organize/"filter" axis (collapse + title-as-rename + count)
                  sits on the left; ALL actions on this category (+ entry, Reset,
                  delete) are gathered into a single right-aligned action group
                  instead of being split across the head and the list bottom. */}
              <div className={styles.groupHead}>
                <button
                  type="button"
                  className={`${styles.groupChevron}${!isCollapsed ? ` ${styles.chevronOpen}` : ""}`}
                  aria-label={
                    isCollapsed ? `Expand ${title}` : `Collapse ${title}`
                  }
                  aria-expanded={!isCollapsed}
                  onClick={() => toggle(cat.id)}
                >
                  <Chevron />
                </button>
                {editing === cat.id ? (
                  <input
                    className={styles.groupTitleInput}
                    aria-label={`Rename ${title} category`}
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitRename(cat.id, title)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(cat.id, title);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditing(null);
                      }
                    }}
                  />
                ) : (
                  // TCK-005/007: the title is the rename affordance (click to edit
                  // inline). A real <button> keeps it keyboard-focusable.
                  <button
                    type="button"
                    className={styles.groupTitle}
                    aria-label={`Rename ${title} category`}
                    title={`Rename ${title} category`}
                    onClick={() => startRename(cat.id, title)}
                  >
                    {title}
                  </button>
                )}
                <span className={styles.groupCount}>{entries.length}</span>

                {/* TCK-018: the consolidated action cluster — add / reset /
                    delete, right-aligned as one group. Previously the "+ New"
                    lived at the BOTTOM of the entry list, apart from edit/delete;
                    it now sits with them so filter + add + edit + delete read as
                    one control. */}
                <div className={styles.groupActions}>
                  {onCreateEntry ? (
                    <button
                      type="button"
                      className={styles.groupAdd}
                      aria-label={`Add new ${categorySingular(title)}`}
                      title={`Add new ${categorySingular(title)}`}
                      onClick={() => onCreateEntry(shelf)}
                    >
                      {"+"}
                    </button>
                  ) : null}
                  {isRenamed(cat.id) ? (
                    <button
                      type="button"
                      className={styles.groupReset}
                      onClick={() => onResetCategory(cat.id)}
                    >
                      Reset
                    </button>
                  ) : null}
                  {/* TCK-005/007: trash icon deletes the whole category (opens the
                      danger confirm in the CALLER via onRequestDeleteCategory —
                      no inline confirm here). Built-ins are not deletable
                      (is_builtin invariant), so the icon is hidden for them. */}
                  {cat.isBuiltin ? null : (
                    <button
                      type="button"
                      className={styles.groupDelete}
                      aria-label={`Delete ${title} category`}
                      title={`Delete ${title} category`}
                      onClick={() => onRequestDeleteCategory(cat.id)}
                    >
                      {"\u{1F5D1}"}
                    </button>
                  )}
                </div>
              </div>

              {!isCollapsed && (
                <ul className={styles.list}>
                  {entries.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        className={
                          e.id === selectedId
                            ? `${styles.item} ${styles.itemActive}`
                            : styles.item
                        }
                        aria-current={e.id === selectedId ? "true" : undefined}
                        onClick={() => onSelect(e.id)}
                      >
                        <span className={styles.itemName}>{e.name}</span>
                        {e.note ? (
                          <span className={styles.itemNote}>{e.note}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                  {entries.length === 0 && onCreateEntry ? (
                    <li>
                      <button
                        type="button"
                        className={styles.emptyAdd}
                        onClick={() => onCreateEntry(shelf)}
                      >
                        + New {categorySingular(title)}
                      </button>
                    </li>
                  ) : null}
                </ul>
              )}
            </section>
          );
        })}
        {/* TCK-005: create a new top-level SIBLING category from the sidebar,
            sharing the main shelf's NewCategoryShelf create path so both columns
            stay in sync. */}
        <NewCategoryShelf onCreate={onCreateCategory} />
        {footer}
      </div>
    </nav>
  );
}
