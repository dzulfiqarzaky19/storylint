"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PlotScreen.module.css";

/** Inline beat text editor (feature 2 create + edit). A small textarea with
 *  save/cancel; Enter (no shift) saves, Escape cancels. Blank text can't save.
 *  Used both in an empty grid cell (create) and in the drawer (edit). */
export function BeatEditor({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial: string;
  pending: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };
  return (
    <div className={styles.beatEditor}>
      <textarea
        ref={ref}
        className={styles.beatInput}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Beat summary"
        aria-label="Beat summary"
      />
      <div className={styles.beatEditorRow}>
        <button type="button" className={styles.beatSave} onClick={save} disabled={pending || !text.trim()}>
          save
        </button>
        <button type="button" className={styles.beatCancelBtn} onClick={onCancel}>
          cancel
        </button>
      </div>
    </div>
  );
}
