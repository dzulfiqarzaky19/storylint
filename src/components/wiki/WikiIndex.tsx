"use client";

import { useId, useState } from "react";
import type { EntryWithDetails, Shelf } from "@/lib/domain/types";
import { SHELF_TITLES } from "@/lib/domain/types";
import styles from "./WikiIndex.module.css";

const SHELF_ORDER: Shelf[] = ["people", "places", "orders", "lore"];

export interface WikiIndexProps {
  /** Entries grouped per shelf, in the reducer's live order. */
  byShelf: Map<Shelf, EntryWithDetails[]>;
  selectedId: string;
  onSelect: (id: string) => void;
  /** Total entry count for the header ("N entries"). */
  total: number;
  /** Start authoring a new entry on the given shelf. */
  onCreate?: (shelf: Shelf) => void;
}

/**
 * The Wiki LEFT sidebar — "The world" grouped index (the screenshot the user
 * shared). Groups are People / Places / Orders / Lore, each collapsible, each
 * listing its entries; clicking one focuses that entry in the main column
 * (same SELECT_ENTRY path the tiles use).
 *
 * Standing full-height column on desktop. On the stacked tier (<=1200px) the
 * whole index folds behind a header TOGGLE (the same collapsible-panel
 * affordance the Research/Write rails use), so a phone/tablet opens on the
 * entry, not a wall of index. The `open` state only affects the stacked tier:
 * on desktop `.panel` is always shown (see the CSS).
 */
export default function WikiIndex({
  byShelf,
  selectedId,
  onSelect,
  total,
  onCreate,
}: WikiIndexProps) {
  // All groups open by default so the whole world is scannable at a glance.
  const [collapsed, setCollapsed] = useState<Record<Shelf, boolean>>({
    people: false,
    places: false,
    orders: false,
    lore: false,
  });
  // Whole-index collapse for the stacked tier. Closed by default so mobile
  // opens on the entry; the toggle is hidden on desktop where it's always open.
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const toggle = (shelf: Shelf) =>
    setCollapsed((c) => ({ ...c, [shelf]: !c[shelf] }));

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
        <span className={styles.railToggleChevron} aria-hidden="true">
          {open ? "\u2212" : "+"}
        </span>
      </button>

      <div id={panelId} className={styles.panel}>
        {SHELF_ORDER.map((shelf) => {
          const entries = byShelf.get(shelf) ?? [];
          const isCollapsed = collapsed[shelf];
          return (
            <section key={shelf} className={styles.group}>
              <button
                type="button"
                className={styles.groupHead}
                aria-expanded={!isCollapsed}
                onClick={() => toggle(shelf)}
              >
                <span className={styles.groupTitle}>{SHELF_TITLES[shelf]}</span>
                <span className={styles.groupCount}>{entries.length}</span>
                <span className={styles.groupChevron} aria-hidden="true">
                  {isCollapsed ? "+" : "\u2212"}
                </span>
              </button>

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
                  {onCreate ? (
                    <li>
                      <button
                        type="button"
                        className={styles.add}
                        onClick={() => onCreate(shelf)}
                      >
                        + New {SHELF_TITLES[shelf].replace(/s$/, "").toLowerCase()}
                      </button>
                    </li>
                  ) : null}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </nav>
  );
}
