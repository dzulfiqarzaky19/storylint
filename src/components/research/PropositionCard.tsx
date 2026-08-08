"use client";

import type { DragEvent } from "react";
import type { ResearchProposition } from "@/lib/domain/types";
import styles from "./ResearchScreen.module.css";

export interface PropositionCardProps {
  card: ResearchProposition;
  kept: boolean;
  inWiki: boolean;
  onKeep: (id: string, next: boolean) => void;
  onPropose: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

/**
 * A research proposition (300px card). Body uses flex:1 so every card in a row
 * aligns its action row. Keep inverts to a filled "Kept"; "Make it an entry"
 * reveals the confirmation strip and reads "In the wiki" once written.
 * README §Screen 2.3 / behavior table.
 */
export default function PropositionCard({
  card,
  kept,
  inWiki,
  onKeep,
  onPropose,
  onDragStart,
  onDragEnd,
}: PropositionCardProps) {
  const handleDragStart = (ev: DragEvent<HTMLDivElement>) => {
    try {
      ev.dataTransfer.effectAllowed = "copy";
      ev.dataTransfer.setData("text/plain", card.id);
    } catch {
      // dataTransfer can be unavailable in some environments; the DragContext
      // carries the real payload, so this is best-effort only.
    }
    onDragStart(card.id);
  };

  return (
    <div
      className={styles.card}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      <div className={styles.cardKicker}>{card.kind}</div>
      <div className={styles.cardTitle}>{card.title}</div>
      <div className={styles.cardBody}>{card.body}</div>
      <div className={styles.cardActions}>
        <button
          type="button"
          className={`${styles.keep}${kept ? ` ${styles.keepActive}` : ""}`}
          aria-pressed={kept}
          onClick={() => onKeep(card.id, !kept)}
        >
          {kept ? "Kept" : "Keep"}
        </button>
        {inWiki ? (
          <span className={`${styles.propose} ${styles.proposeInWiki}`}>
            In the wiki
          </span>
        ) : (
          <button
            type="button"
            className={styles.propose}
            onClick={() => onPropose(card.id)}
          >
            Make it an entry
          </button>
        )}
      </div>
    </div>
  );
}
