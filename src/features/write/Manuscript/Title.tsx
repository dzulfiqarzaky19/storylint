"use client";

import { useCallback, useEffect, useRef } from "react";

interface TitleProps {
  /** The chapter number this title belongs to (passed back to onRename). */
  number: number;
  /** The saved title (server source of truth). */
  title: string;
  /** Commit a new title. The parent persists it and re-pulls the server render. */
  onRename: (n: number, title: string) => void;
  /** Class for the heading element (keeps the manuscript <h1> styling). */
  className?: string;
}

/**
 * The MAIN manuscript title, rendered click-to-edit — the same affordance the
 * sidebar row title has (Chapters/EditableTitle), so a writer can rename from
 * either place. Enter commits and blurs; Escape reverts to the saved title; blur
 * commits (a click-away is an implicit confirm). An empty/whitespace title is
 * refused (reverts) so a chapter never loses its name. The saved `title` prop is
 * the source of truth: when it changes from OUTSIDE an edit (e.g. a fresh server
 * render after the sidebar renames the same chapter) the DOM text resyncs, which
 * is what kept the old plain <h1> stale after a sidebar rename.
 */
export default function Title({
  number,
  title,
  onRename,
  className,
}: TitleProps) {
  const ref = useRef<HTMLHeadingElement | null>(null);

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
      el.textContent = title;
      return;
    }
    onRename(number, next);
  }, [number, title, onRename]);

  return (
    <h1
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-label="Chapter title"
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
    </h1>
  );
}
