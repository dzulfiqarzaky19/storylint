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

const STACKED = "(max-width: 1200px)";

function useStacked(): boolean {
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(STACKED);
    const sync = () => setStacked(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return stacked;
}

function scrollKey(name: string): string {
  return `indexrail:scroll:${name}`;
}

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
  }
}

export interface IndexRailFilter {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export interface IndexRailProps {
  title: string;
  count?: number;
  ariaLabel?: string;
  toggleLabel: string;
  filter?: IndexRailFilter;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

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
    const offset = current.getBoundingClientRect().top - el.getBoundingClientRect().top;
    el.scrollTop += offset - (el.clientHeight - current.clientHeight) / 2;
  }, [landmark]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
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

        <div ref={scrollRef} className={styles.railScroll}>
          {children}
          {footer}
        </div>
      </div>
    </nav>
  );
}
