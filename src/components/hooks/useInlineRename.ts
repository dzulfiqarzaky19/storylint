"use client";

import { useState } from "react";

/**
 * T-ARCH-7 — dedups the inline-rename INTERACTION shape shared by
 * wiki/shelf/Shelf.tsx, wiki/shelf/WikiIndex.tsx, and plot/PlotScreen.tsx's StoryDrawer:
 * click-to-edit a draft string, Enter commits, Escape cancels (reverting to
 * `currentValue`), blur commits. This is dedup, NOT unification — the hook
 * owns only the draft-state/key-dispatch shape. What "commit" MEANS (blank
 * resets vs. no-op, whether a reset path exists at all) stays the caller's
 * own decision via `onCommit`/`onReset`, so each site's exact prior behavior
 * is unchanged: Shelf resets on a blank draft, WikiIndex routes the decision
 * through resolveRename, PlotScreen has no reset branch (a blank draft there
 * is simply not committed — see plot/PlotScreen.tsx).
 */
export interface UseInlineRenameOptions {
  /** Called with the raw (untrimmed) draft when Enter or blur commits. */
  onCommit: (draft: string) => void;
  /**
   * Called when Escape cancels an edit that had cleared the draft. Only
   * PlotScreen's caller omits this (it has no reset affordance); Shelf and
   * WikiIndex don't currently pass it either — Escape there just discards the
   * draft in place, matching each site's pre-existing behavior.
   */
  onReset?: () => void;
}

export interface UseInlineRename {
  /** True while the draft input should render instead of the static label. */
  editing: boolean;
  /** Current draft text (seeded from `currentValue` on start). */
  draft: string;
  /** Begin editing; seeds the draft from the live value at call time. */
  start: (seed: string) => void;
  /** Update the draft as the user types. */
  setDraft: (value: string) => void;
  /** Wire directly to the input's onKeyDown. */
  onKeyDown: (e: { key: string; preventDefault: () => void }) => void;
  /** Wire directly to the input's onBlur — this COMMITS, matching the sites that
   *  treat a click-away as an implicit confirm. */
  onBlur: () => void;
  /**
   * Abandon the edit without committing. Same thing Escape does, exposed so a
   * caller can choose cancel-on-blur instead: /research treats a click-away as
   * "I changed my mind", so a half-typed thread name is never written. Wire it to
   * onBlur INSTEAD of `onBlur` above — never both.
   */
  cancel: () => void;
}

/**
 * `currentValue` is read fresh on each commit (not captured at `start`) so a
 * value that changes out from under an open edit (e.g. an external rename
 * landing) doesn't commit a stale comparison.
 */
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
