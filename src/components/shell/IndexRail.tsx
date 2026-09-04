"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./IndexRail.module.css";

/** Disclosure chevron. A right-pointing glyph; direction is driven by CSS (the
 *  "open" modifier rotates it 90deg). Decorative — state lives on aria-expanded. */
function Chevron() {
  return (
    <svg
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

export interface IndexRailFilter {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export interface IndexRailProps {
  /** Mono uppercase label in the rail head, e.g. "All entries". */
  title: string;
  /** Rendered after the title as "· N". Omit to show the title alone. */
  count?: number;
  /** aria-label for the stacked-tier disclosure, e.g. "Toggle entries". */
  toggleLabel: string;
  /** Omit for a rail with no filter (write, research). Supplying it also arms
   *  the "/" focus hotkey. */
  filter?: IndexRailFilter;
  /** Right-hand slot in the rail head — the head becomes a space-between row. */
  action?: ReactNode;
  /** Rendered at the TAIL of the scrolling list (e.g. the wiki trash), never as
   *  a sibling that competes with it for height. */
  footer?: ReactNode;
  /** The per-surface list: entries, chapters, or threads. */
  children: ReactNode;
}

/**
 * IndexRail — the shared LEFT index rail wrapper for /wiki, /write and /research.
 *
 * Deliberately NOT used by /plot: the plot prototype has no index rail, it uses a
 * modal drill-down drawer instead.
 *
 * Owns all the chrome (head, optional filter + "/" hotkey, scroll containment,
 * the <=1200px fold behind a disclosure, ARIA wiring, viewport width steps) so a
 * surface supplies only its own list. Name is `IndexRail`, never `Rail`: this repo
 * already uses "rail" for the RIGHT signal panels (OutstandingRail, KeptBoard,
 * PosterBand) and for the `Mark.rail` string field.
 */
export default function IndexRail({
  title,
  count,
  toggleLabel,
  filter,
  action,
  footer,
  children,
}: IndexRailProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the filter, matching the prototype's shortcut chip. Ignored while
  // the caret is already in a field (or a ProseMirror surface on /write), so the
  // hotkey can never swallow a literal slash the writer is typing.
  useEffect(() => {
    if (!filter) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      e.preventDefault();
      setOpen(true);
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [filter]);

  return (
    <nav
      className={`${styles.index} ${open ? styles.indexOpen : ""}`}
      aria-label={title}
    >
      <button
        type="button"
        className={styles.railToggle}
        aria-label={toggleLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.railHead}>
          <span className={styles.railTitle}>{title}</span>
          {count !== undefined && (
            <span className={styles.railCount}>{`· ${count}`}</span>
          )}
        </span>
        {action ? <span className={styles.railAction}>{action}</span> : null}
        <span
          className={`${styles.railToggleChevron}${open ? ` ${styles.chevronOpen}` : ""}`}
          aria-hidden="true"
        >
          <Chevron />
        </span>
      </button>

      <div id={panelId} className={styles.panel}>
        {filter ? (
          <div className={styles.railSearch}>
            <span className={styles.searchIcon} aria-hidden="true">
              {"\u{1F50E}"}
            </span>
            <input
              ref={inputRef}
              type="search"
              value={filter.value}
              placeholder={filter.placeholder}
              aria-label={filter.placeholder}
              onChange={(e) => filter.onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                filter.onChange("");
                e.currentTarget.blur();
              }}
            />
            <span className={styles.searchShortcut} aria-hidden="true">
              /
            </span>
          </div>
        ) : null}

        {/* The footer sits INSIDE the scroll area, as the prototype has it. As a
            sibling of railScroll it competes for height and, being unbounded (31
            deleted entries), starves the flex:1 list down to zero. */}
        <div className={styles.railScroll}>
          {children}
          {footer}
        </div>
      </div>
    </nav>
  );
}
