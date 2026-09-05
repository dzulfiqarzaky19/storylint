"use client";

// Small inline editor used across the Wiki entry band for manual authoring
// (Track A). Click the text to edit; Enter (or blur) commits, Escape cancels.
// The commit fires the paired reducer action + server action in the parent, so
// a manual edit is an EXPLICIT confirmation (product rule 1). Rendering stays
// visually identical to the static text when not editing, so the band does not
// jump around.

import { useEffect, useRef, useState } from "react";
import styles from "./InlineText.module.css";

interface InlineTextProps {
  value: string;
  onCommit: (next: string) => void;
  /** Render as a multi-line textarea (summaries) vs single-line input. */
  multiline?: boolean;
  /** Class applied to BOTH the static span and the editor, so type matches. */
  className?: string;
  placeholder?: string;
  ariaLabel: string;
}

export default function InlineText({
  value,
  onCommit,
  multiline = false,
  className,
  placeholder = "Empty",
  ariaLabel,
}: InlineTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Keep the draft in sync when the underlying value changes while not editing.
  // React's "adjust state during render" pattern: setting state on the current
  // component while rendering re-renders it immediately with no visible flash,
  // instead of an effect (which paints the stale draft first, then corrects).
  const [lastValue, setLastValue] = useState(value);
  if (!editing && value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== value) onCommit(next);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  if (!editing) {
    // No aria-label here: the button's accessible name must stay the visible
    // text (e.g. the entry name) so headings keep their name. The edit hint
    // lives in `title` only. Empty values fall back to the field label so the
    // control is still reachable/announced.
    const hasValue = value.trim().length > 0;
    return (
      <button
        type="button"
        className={`${styles.static} ${className ?? ""}`}
        onClick={() => setEditing(true)}
        aria-label={hasValue ? undefined : `Edit ${ariaLabel}`}
        title={`Edit ${ariaLabel}`}
      >
        {value || <span className={styles.placeholder}>{placeholder}</span>}
      </button>
    );
  }

  const commonProps = {
    ref: inputRef as never,
    className: `${styles.editor} ${className ?? ""}`,
    value: draft,
    "aria-label": ariaLabel,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        commit();
      }
    },
  };

  return multiline ? (
    <textarea {...commonProps} rows={3} />
  ) : (
    <input type="text" {...commonProps} />
  );
}
