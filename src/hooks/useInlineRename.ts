"use client";

import { useState } from "react";

export interface UseInlineRenameOptions {
  onCommit: (draft: string) => void;
  onReset?: () => void;
}

export interface UseInlineRename {
  editing: boolean;
  draft: string;
  start: (seed: string) => void;
  setDraft: (value: string) => void;
  onKeyDown: (e: { key: string; preventDefault: () => void }) => void;
  onBlur: () => void;
  cancel: () => void;
}

export function useInlineRename(
  currentValue: string,
  { onCommit, onReset }: UseInlineRenameOptions,
): UseInlineRename {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);

  const commit = () => {
    if (!editing) return;
    setEditing(false);
    onCommit(draft);
  };

  const cancel = () => {
    setEditing(false);
    onReset?.();
  };

  return {
    editing,
    draft,
    start: (seed: string) => {
      setDraft(seed);
      setEditing(true);
    },
    setDraft,
    onKeyDown: (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    onBlur: commit,
    cancel,
  };
}
