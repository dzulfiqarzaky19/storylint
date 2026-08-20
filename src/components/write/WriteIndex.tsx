"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
  /** Commit a new title for a chapter (inline rename of the active row). */
  onRename?: (n: number, title: string) => void;
  /** Ask to delete a chapter (opens the caller's confirm modal). */
  onRequestDelete?: (n: number) => void;
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
 * The active chapter's title, rendered click-to-edit (same affordance as the
 * wiki). It lives INSIDE the row button, so every pointer/key event that drives
 * editing must stopPropagation — otherwise the row's select handler fires and
 * the caret is stolen. Enter commits and blurs; Escape reverts to the saved
 * title. Blur commits too (a click-away is an implicit confirm). Committing an
 * empty/whitespace title is refused (reverts), so a chapter never loses its name.
 */
function EditableTitle({
  number,
  title,
  onRename,
}: {
  number: number;
  title: string;
  onRename?: (n: number, title: string) => void;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  // Keep the DOM text in sync when the saved title changes from OUTSIDE an edit
  // (e.g. a fresh server render after rename). We never rewrite it mid-edit —
  // that would fight the caret — so this only runs when the element isn't focused.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== title) {
      el.textContent = title;
    }
  }, [title]);

  const commit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = (el.textContent ?? "").trim();
    if (!next || next === title) {
      // Empty or unchanged → revert the DOM to the saved title, write nothing.
      el.textContent = title;
      return;
    }
    onRename?.(number, next);
  }, [number, title, onRename]);

  return (
    <span
      ref={ref}
      className={`${styles.itemName} write-chapter-title`}
      // The row button carries aria-current for the nav-state test; this span
      // repeats it so a descendant selector (filter has [aria-current]) can reach
      // INTO the active row for the editable title, which a button-only attribute
      // can't satisfy.
      aria-current="true"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          ref.current?.blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          if (ref.current) ref.current.textContent = title;
          ref.current?.blur();
        }
      }}
      onBlur={commit}
    >
      {title}
    </span>
  );
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
  onRename,
  onRequestDelete,
}: WriteIndexProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const stacked = useIsStackedTier();

  const active = chapters.find((c) => c.number === selectedNumber);
  // Deleting the last chapter would leave a book with none, so the affordance is
  // disabled at one chapter (the server enforces the same invariant). One delete
  // button targets the ACTIVE chapter, kept out of the row list so it never
  // inflates the chapter-row count the way a per-row button would.
  const canDelete = chapters.length > 1;

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
        {chapters.map((c) => {
          const isActive = c.number === selectedNumber;
          return (
            <li key={c.number}>
              <button
                type="button"
                className={
                  isActive ? `${styles.item} ${styles.itemActive}` : styles.item
                }
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelect(c.number)}
              >
                <span className={styles.itemNote}>
                  Chapter {numberWord(c.number)}
                </span>
                {isActive ? (
                  <EditableTitle
                    number={c.number}
                    title={c.title}
                    onRename={onRename}
                  />
                ) : (
                  <span className={styles.itemName}>{c.title}</span>
                )}
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
          );
        })}
        {onCreate ? (
          <li>
            <button type="button" className={styles.add} onClick={onCreate}>
              + New chapter
            </button>
          </li>
        ) : null}
        {active && onRequestDelete ? (
          <li>
            <button
              type="button"
              className={styles.delete}
              disabled={!canDelete}
              aria-label={`Delete chapter ${active.number}: ${active.title}`}
              onClick={() => onRequestDelete(active.number)}
            >
              Delete this chapter
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
