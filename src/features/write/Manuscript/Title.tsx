"use client";

import { useCallback, useEffect, useRef } from "react";

interface TitleProps {
  number: number;
  title: string;
  onRename: (n: number, title: string) => void;
  className?: string;
}

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
