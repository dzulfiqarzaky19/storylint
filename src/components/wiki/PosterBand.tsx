"use client";

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

// Full-bleed accent poster. Renders ONLY when suggestions exist (HANDOFF §4).
// Each card is a draggable SOURCE ("card" item): drop it on the Details column to
// add-as-fresh-fact. The buttons are the explicit alternative: "Write it in"
// routes through the confirmation-gated Server Action (PRODUCT RULE 1), "Leave
// it" only dismisses.
export default function PosterBand({
  suggestions,
  onWriteIn,
  onLeave,
}: PosterBandProps) {
  const drag = useDrag();
  if (suggestions.length === 0) return null;

  return (
    <section className={styles.band} aria-label="Suggestions from the manuscript">
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
    </section>
  );
}
