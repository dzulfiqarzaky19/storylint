"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import IndexRail from "@/components/shell/IndexRail";
import { PencilIcon, TrashIcon } from "@/components/shell/RowIcons";
import styles from "./WriteIndex.module.css";
import type { ChapterSeverity } from "@/lib/check/severity";
import { shouldShowChapterDot } from "@/lib/check/severity";

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
  /** Commit a new title for a chapter (inline rename of the row). */
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
 * A chapter's title, rendered click-to-edit.
 *
 * It is a SIBLING of the row's select button, never a child of it. A
 * contenteditable element is interactive content, and `<button>` may not contain
 * interactive content: nested, assistive tech announced the button and swallowed
 * the editable region entirely, and the row needed four stopPropagation handlers
 * to keep the caret from being stolen. The select button is now a stretched
 * overlay behind the row (see `.itemSelect`), the title sits above it with its
 * own pointer-events, and the propagation fight is gone.
 *
 * Enter commits and blurs; Escape reverts to the saved title. Blur commits too (a
 * click-away is an implicit confirm) — which is the opposite of /research, where
 * a click-away cancels. The two differ on purpose: this title mirrors the
 * manuscript's own H1, which is a live editing surface, not a form field.
 * Committing an empty/whitespace title is refused (reverts), so a chapter never
 * loses its name.
 */
function EditableTitle({
  number,
  title,
  active,
  claimFocus,
  onRename,
  onDone,
}: {
  number: number;
  title: string;
  /** Only the ACTIVE row's title carries aria-current — a nav-state selector
   *  reaches through it to find the open chapter, so it must stay unique. */
  active: boolean;
  /** True when the row's pencil was just clicked: take the caret and select all. */
  claimFocus: boolean;
  onRename?: (n: number, title: string) => void;
  onDone?: () => void;
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

  // The pencil is a rename affordance, so it must land the writer IN the field
  // with the old name selected — otherwise they still have to click the text and
  // clear it by hand, and the button saved them nothing.
  useEffect(() => {
    const el = ref.current;
    if (!claimFocus || !el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [claimFocus]);

  const commit = useCallback(() => {
    const el = ref.current;
    onDone?.();
    if (!el) return;
    const next = (el.textContent ?? "").trim();
    if (!next || next === title) {
      // Empty or unchanged → revert the DOM to the saved title, write nothing.
      el.textContent = title;
      return;
    }
    onRename?.(number, next);
  }, [number, title, onRename, onDone]);

  return (
    <span
      ref={ref}
      className={`${styles.itemName} write-chapter-title`}
      // The row button carries aria-current for the nav-state test; this span
      // repeats it so a descendant selector (filter has [aria-current]) can reach
      // INTO the active row for the editable title, which a button-only attribute
      // can't satisfy.
      aria-current={active ? "true" : undefined}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onKeyDown={(e) => {
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
 * The Write LEFT index rail CONTENTS — the chapter list. One flat, ordered list;
 * clicking a chapter loads it, and each row carries the same hover-revealed
 * rename/delete pair the wiki's category rows do (shared glyphs, shell/RowIcons).
 *
 * All rail CHROME (head, scroll containment, the <=1200px fold, ARIA, viewport
 * widths) belongs to the shared `IndexRail`; this module owns only the chapter
 * rows and the "+ New chapter" tail. See CONTEXT.md → Chrome → index rail.
 */
export default function WriteIndex({
  chapters,
  selectedNumber,
  onSelect,
  onCreate,
  onRename,
  onRequestDelete,
}: WriteIndexProps) {
  // The row whose pencil was just pressed, so its title can claim the caret.
  // Cleared on commit/cancel; the ACTIVE row is always editable regardless.
  const [editingNumber, setEditingNumber] = useState<number | null>(null);
  // Deleting the last chapter would leave a book with none, so every row's
  // delete is disabled at one chapter (the server enforces the same invariant).
  const canDelete = chapters.length > 1;

  return (
    <IndexRail
      title="Chapters"
      count={chapters.length}
      toggleLabel="Toggle chapters"
    >
      <ul className={styles.list}>
        {chapters.map((c) => {
          const isActive = c.number === selectedNumber;
          const editable = isActive || editingNumber === c.number;
          return (
            <li key={c.number}>
              <div
                className={
                  isActive
                    ? `${styles.itemRow} ${styles.itemRowActive}`
                    : styles.itemRow
                }
              >
                {/* The select target is a stretched, EMPTY overlay covering the
                    whole row. Empty because the row's content includes an
                    editable title, and a <button> may not contain interactive
                    content — so the content sits above the button rather than
                    inside it. Clicking anywhere in the row still selects; only
                    the title itself takes its own clicks (see .itemName). */}
                <button
                  type="button"
                  className={styles.itemSelect}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`Chapter ${c.number}: ${c.title}`}
                  onClick={() => onSelect(c.number)}
                />
                <span className={styles.itemBody}>
                  <span className={styles.itemNote}>
                    Chapter {numberWord(c.number)}
                  </span>
                  {editable && onRename ? (
                    <EditableTitle
                      number={c.number}
                      title={c.title}
                      active={isActive}
                      claimFocus={editingNumber === c.number}
                      onRename={onRename}
                      onDone={() => setEditingNumber(null)}
                    />
                  ) : (
                    <span className={styles.itemName}>{c.title}</span>
                  )}
                </span>
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

                {onRename || onRequestDelete ? (
                  <div className={styles.rowActions}>
                    {onRename ? (
                      <button
                        type="button"
                        className={styles.rowAction}
                        data-slot="rename"
                        aria-label={`Rename chapter ${c.number}: ${c.title}`}
                        title="Rename chapter"
                        onClick={() => setEditingNumber(c.number)}
                      >
                        <PencilIcon />
                      </button>
                    ) : null}
                    {onRequestDelete ? (
                      <button
                        type="button"
                        className={`${styles.rowAction} ${styles.rowDelete}`}
                        disabled={!canDelete}
                        aria-label={`Delete chapter ${c.number}: ${c.title}`}
                        title="Delete chapter"
                        onClick={() => onRequestDelete(c.number)}
                      >
                        <TrashIcon />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
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
      </ul>
    </IndexRail>
  );
}
