"use client";

import { useId, useState } from "react";
import { sugHeadline } from "@/features/wiki/lib/derive";
import { useDrag } from "@/features/wiki/dnd/DragContext";
import type { WikiSuggestion } from "@/domain/types";
import styles from "./Suggestions.module.css";

interface SuggestionsProps {
  suggestions: WikiSuggestion[];
  onWriteIn: (s: WikiSuggestion) => void;
  onLeave: (s: WikiSuggestion) => void;
}

export default function Suggestions({
  suggestions,
  onWriteIn,
  onLeave,
}: SuggestionsProps) {
  const drag = useDrag();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  if (suggestions.length === 0) return null;

  return (
    <section
      className={`${styles.band} ${open ? styles.bandOpen : ""}`}
      aria-label="Suggestions from the manuscript"
    >
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.toggleLabel}>{sugHeadline(suggestions.length)}</span>
        <span className={styles.toggleChevron} aria-hidden="true">
          {open ? "\u2212" : "+"}
        </span>
      </button>

      <div id={bodyId} className={styles.bandBody}>
        <h2 className={styles.headline}>{sugHeadline(suggestions.length)}</h2>
        <div className={styles.cards}>
          {suggestions.map((s) => (
            <article
              key={s.suggestionKey}
              className={styles.card}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData("text/plain", s.suggestionKey);
                drag.startDrag({ type: "card", id: s.suggestionKey, from: "poster" });
              }}
              onDragEnd={() => drag.endDrag()}
            >
              <p className={styles.source}>{s.source}</p>
              <p className={styles.text}>{s.text}</p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.writeIn}
                  onClick={() => onWriteIn(s)}
                >
                  Write it in
                </button>
                <button
                  type="button"
                  className={styles.leaveIt}
                  onClick={() => onLeave(s)}
                >
                  Leave it
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
