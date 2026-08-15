"use client";

import { useId, useState } from "react";
import { sugHeadline } from "@/lib/domain/derive";
import { useDrag } from "@/components/dnd/DragContext";
import type { WikiSuggestion } from "@/lib/state/wikiStore";
import styles from "./PosterBand.module.css";

interface PosterBandProps {
  suggestions: WikiSuggestion[];
  /** "Write it in" — add the suggestion as a fresh fact (confirmation-gated). */
  onWriteIn: (s: WikiSuggestion) => void;
  /** "Leave it" — dismiss the suggestion without writing anything. */
  onLeave: (s: WikiSuggestion) => void;
}

// Full-bleed accent poster. Renders ONLY when suggestions exist.
// Each card is a draggable SOURCE ("card" item): drop it on the Details column to
// add-as-fresh-fact. The buttons are the explicit alternative: "Write it in"
// routes through the confirmation-gated Server Action (PRODUCT RULE 1), "Leave
// it" only dismisses.
//
// On desktop the band is the page-footer poster it has always been. On phones
// (<=560px) it becomes a collapsible bar pinned to the bottom of the viewport,
// mirroring the Write "Two signals" rail and Research KEPT board so the three
// screens share ONE standing-panel affordance. The toggle is hidden on desktop
// (CSS) and the body renders via display:contents so desktop layout is
// unchanged.
export default function PosterBand({
  suggestions,
  onWriteIn,
  onLeave,
}: PosterBandProps) {
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
