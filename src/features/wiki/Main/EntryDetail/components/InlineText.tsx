"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./InlineText.module.css";

interface InlineTextProps {
  value: string;
  onCommit: (next: string) => void;
  multiline?: boolean;
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
