"use client";

import { useCallback, useId, useState, useSyncExternalStore } from "react";
import styles from "./WriteIndex.module.css";
import type { ChapterSeverity } from "@/lib/check/severity";
import { shouldShowChapterDot } from "@/lib/check/severity";

/** The stacked-tier breakpoint — mirrors @media(max-width:1200px) in the CSS. */
const STACKED_QUERY = "(max-width: 1200px)";

/**
 * True only on the stacked tier (<=1200px), where the chapter `.panel` folds
 * behind the header toggle. Above 1200px the panel is ALWAYS shown, so the
 * header must NOT masquerade as a collapse control (see WriteIndex). SSR-safe
 * via useSyncExternalStore: the server snapshot is `false` (desktop, plain
 * heading — no focusable no-op button in the pre-hydration HTML), then the
 * client subscribes to the live media query.
 */
function useIsStackedTier(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const mql = window.matchMedia(STACKED_QUERY);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  const getSnapshot = () =>
    typeof window !== "undefined" && !!window.matchMedia
      ? window.matchMedia(STACKED_QUERY).matches
      : false;
  const getServerSnapshot = () => false;
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export interface WriteIndexChapter {
  number: number;
  title: string;
  /**
   * Left-index dot severity for this chapter (Feature 1): 'red' for a
   * contradiction, 'yellow' for unrecorded-only, null/undefined for a clean
   * chapter (no dot). The ACTIVE chapter is passed null by the page — the writer
   * already sees its marks in the right rail.
   */
  severity?: ChapterSeverity;
}

export interface WriteIndexProps {
  chapters: WriteIndexChapter[];
  selectedNumber: number;
  /** Navigate to a chapter (URL-driven; the screen pushes ?chapter=<n>). */
  onSelect: (n: number) => void;
  /** Append a new empty chapter. */
  onCreate?: () => void;
}

/** Spell small chapter numbers ("Chapter seven") to match the manuscript eyebrow. */
function numberWord(n: number): string {
  const words = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve",
  ];
  return words[n] ?? String(n);
}

/**
 * The Write LEFT sidebar — the chapter list. One flat, ordered list; clicking a
 * chapter loads it. Shares the Wiki/Research index visual language (300px
 * standing rail on desktop; on the stacked tier <=1200px the whole list folds
 * behind a header toggle) so all three screens read as one app. The `open`
 * state only affects the stacked tier — on desktop `.panel` is always shown.
 */
export default function WriteIndex({
  chapters,
  selectedNumber,
  onSelect,
  onCreate,
}: WriteIndexProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const stacked = useIsStackedTier();

  // Header content is identical across tiers; only its SEMANTICS differ.
  const headerInner = (
    <>
      <span className={styles.title}>Chapters</span>
      <span className={styles.count}>{chapters.length}</span>
    </>
  );

  return (
    <nav
      className={`${styles.index} ${open ? styles.indexOpen : ""}`}
      aria-label="Chapters"
    >
      {stacked ? (
        // Stacked tier (<=1200px): the panel folds, so the header is a REAL
        // collapse toggle with an honest aria-expanded/aria-controls.
        <button
          type="button"
          className={styles.railToggle}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          {headerInner}
          <span className={styles.railToggleChevron} aria-hidden="true">
            {open ? "\u2212" : "+"}
          </span>
        </button>
      ) : (
        // Desktop (>1200px): the panel is always shown, so the header is a plain
        // heading — no button role, no (lying) aria-expanded, not focusable.
        <h2 className={styles.railToggle}>{headerInner}</h2>
      )}

      <ul id={panelId} className={styles.panel}>
        {chapters.map((c) => (
          <li key={c.number}>
            <button
              type="button"
              className={
                c.number === selectedNumber
                  ? `${styles.item} ${styles.itemActive}`
                  : styles.item
              }
              aria-current={c.number === selectedNumber ? "true" : undefined}
              onClick={() => onSelect(c.number)}
            >
              <span className={styles.itemNote}>
                Chapter {numberWord(c.number)}
              </span>
              <span className={styles.itemName}>{c.title}</span>
              {shouldShowChapterDot(c.severity, c.number, selectedNumber) ? (
                <span
                  className={`${styles.dot} ${
                    c.severity === "red" ? styles.dotRed : styles.dotYellow
                  }`}
                  aria-label={
                    c.severity === "red"
                      ? "Has a contradiction"
                      : "Has an unrecorded detail"
                  }
                />
              ) : null}
            </button>
          </li>
        ))}
        {onCreate ? (
          <li>
            <button type="button" className={styles.add} onClick={onCreate}>
              + New chapter
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
