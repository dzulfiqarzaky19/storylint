"use client";

import type { ReactNode } from "react";
import type { ResearchTurnWithCards } from "@/domain/types";
import { voiceLabel } from "@/features/research/lib/voice";
import styles from "./Thread.module.css";

export interface TurnProps {
  turn: ResearchTurnWithCards;
  renderCard: (card: ResearchTurnWithCards["cards"][number]) => ReactNode;
}

export default function Turn({ turn, renderCard }: TurnProps) {
  const isYou = turn.side === "you";
  const whoLabel = voiceLabel(turn.who);
  const isThinking = !isYou && turn.text.length === 0;
  return (
    <div className={styles.turn}>
      <div className={styles.turnRow}>
        <div className={`${styles.who} ${isYou ? styles.whoYou : styles.whoThem}`}>
          {whoLabel}
        </div>
        <div className={`${styles.turnText}${isYou ? ` ${styles.turnTextYou}` : ""}`}>
          {isThinking ? (
            <span className={styles.thinking} aria-label="Thinking" role="status">
              <span />
              <span />
              <span />
            </span>
          ) : (
            <>{turn.text}</>
          )}
        </div>
      </div>
      {turn.cards.length > 0 && (
        <div className={styles.cards}>{turn.cards.map(renderCard)}</div>
      )}
    </div>
  );
}
