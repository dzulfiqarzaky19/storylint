"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Chevron, SearchIcon } from "./RowIcons";
import styles from "./IndexRail.module.css";

/** The width at which the rail stops being a standing column and folds behind a
 *  disclosure. Mirrors the 1200px breakpoint in IndexRail.module.css — the two
 *  must agree, because above it the head is not a control at all. */
const STACKED = "(max-width: 1200px)";

/**
 * True while the rail is in its stacked (folding) tier.
 *
 * The head can only be a BUTTON on that tier: above 1200px the panel is always
 * open, so a button there would be a focusable control announcing an expanded
 * state that never changes — a keyboard user tabs onto it, presses it, and
 * nothing happens. Starts false so the server renders the desktop (non-control)
 * head and hydration has nothing to reconcile.
 */
function useStacked(): boolean {
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    // Guarded: matchMedia is absent in the component-test DOM (and in any
    // non-browser renderer). Without it the rail simply stays in its desktop
    // shape, which is the safe default — a static head, never a dead control.
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(STACKED);
    const sync = () => setStacked(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return stacked;
}

/** sessionStorage key for one rail's scroll offset, namespaced by its landmark. */
function scrollKey(name: string): string {
  return `indexrail:scroll:${name}`;
}

/**
 * Read a rail's remembered scroll offset. Wrapped because sessionStorage THROWS
 * (not returns null) in a private window or with site data blocked, and a rail
 * that cannot remember where it was must still render.
 */
function readOffset(name: string): number | null {
  try {
    const raw = sessionStorage.getItem(scrollKey(name));
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeOffset(name: string, top: number): void {
  try {
    sessionStorage.setItem(scrollKey(name), String(top));
  } catch {
    // Storage unavailable — the rail just forgets its place. Not worth failing.
  }
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
  /** Accessible name for the <nav> landmark. Defaults to `title`; pass this when
   *  the surface's landmark name is not the visible head label (the wiki rail
   *  reads "All entries" but has always been announced as "The world"). */
  ariaLabel?: string;
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
  ariaLabel,
  toggleLabel,
  filter,
  action,
  footer,
  children,
}: IndexRailProps) {
  const [open, setOpen] = useState(false);
  const stacked = useStacked();
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const landmark = ariaLabel ?? title;

  // Keep the rail's place across a REMOUNT. /write keys its screen by chapter
  // number, so selecting a chapter tears the whole subtree down and builds it
  // again — a brand-new scroll container starts at 0, and a writer on chapter 88
  // was thrown back to chapter 1 every time they moved. The offset is restored
  // in a LAYOUT effect (before paint), so the rail never visibly jumps.
  //
  // With nothing remembered — a cold load, or a deep link — the rail instead
  // brings the current row into view, which is the same intent: show the writer
  // where they are, not the top of a list of 108.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = readOffset(landmark);
    if (saved !== null) {
      el.scrollTop = saved;
      return;
    }
    const current = el.querySelector('[aria-current="true"]');
    if (!current) return;
    // Centred by arithmetic, not scrollIntoView: that method walks up and
    // scrolls every ancestor too, which would yank the whole page.
    const offset = current.getBoundingClientRect().top - el.getBoundingClientRect().top;
    el.scrollTop += offset - (el.clientHeight - current.clientHeight) / 2;
  }, [landmark]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Coalesced to one write per frame: scroll fires far faster than that, and
    // sessionStorage is a synchronous write.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        writeOffset(landmark, el.scrollTop);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, [landmark]);

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

  // The head's CONTENTS are the same either way; only the element around them
  // changes with the tier, so they are built once. `action` is deliberately NOT
  // in here: it is a caller-supplied control, and on the stacked tier this markup
  // is wrapped in a <button>, which may not contain another one.
  const head = (
    <>
      <span className={styles.railHead}>
        <span className={styles.railTitle}>{title}</span>
        {count !== undefined && (
          <span className={styles.railCount}>{`· ${count}`}</span>
        )}
      </span>
      <span
        className={`${styles.railToggleChevron}${open ? ` ${styles.chevronOpen}` : ""}`}
        aria-hidden="true"
      >
        <Chevron />
      </span>
    </>
  );

  return (
    <nav
      className={`${styles.index} ${open ? styles.indexOpen : ""}`}
      aria-label={ariaLabel ?? title}
    >
      <div className={styles.railHeadRow}>
        {stacked ? (
          <button
            type="button"
            className={styles.railToggle}
            aria-label={toggleLabel}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            {head}
          </button>
        ) : (
          // Above the fold breakpoint the head is a static label, not a control —
          // there is nothing to expand, so there is nothing to put in the tab order.
          <div className={styles.railToggle}>{head}</div>
        )}
        {action ? <span className={styles.railAction}>{action}</span> : null}
      </div>

      <div id={panelId} className={styles.panel}>
        {filter ? (
          <div className={styles.railSearch}>
            <span className={styles.searchIcon} aria-hidden="true">
              <SearchIcon />
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
        <div ref={scrollRef} className={styles.railScroll}>
          {children}
          {footer}
        </div>
      </div>
    </nav>
  );
}
