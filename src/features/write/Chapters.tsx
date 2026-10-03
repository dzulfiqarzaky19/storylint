"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import IndexRail from "@/components/shell/IndexRail";
import { PencilIcon, TrashIcon } from "@/components/shell/RowIcons";
import styles from "./Chapters.module.css";
import type { ChapterSeverity } from "@/domain/check/severity";
import { shouldShowChapterDot } from "@/domain/check/severity";

export interface ChaptersChapter {
  number: number;
  title: string;
  severity?: ChapterSeverity;
}

export interface ChaptersProps {
  chapters: ChaptersChapter[];
  selectedNumber: number;
  onSelect: (n: number) => void;
  onCreate?: () => void;
  onRename?: (n: number, title: string) => void;
  onRequestDelete?: (n: number) => void;
}

function numberWord(n: number): string {
  const words = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve",
  ];
  return words[n] ?? String(n);
}

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
  active: boolean;
  claimFocus: boolean;
  onRename?: (n: number, title: string) => void;
  onDone?: () => void;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== title) {
      el.textContent = title;
    }
  }, [title]);

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
      el.textContent = title;
      return;
    }
    onRename?.(number, next);
  }, [number, title, onRename, onDone]);

  return (
    <span
      ref={ref}
      className={`${styles.itemName} write-chapter-title`}
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

export default function Chapters({
  chapters,
  selectedNumber,
  onSelect,
  onCreate,
  onRename,
  onRequestDelete,
}: ChaptersProps) {
  const [editingNumber, setEditingNumber] = useState<number | null>(null);
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
