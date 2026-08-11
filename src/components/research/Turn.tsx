"use client";

import type { ReactNode } from "react";
import type { ResearchTurnWithCards } from "@/lib/domain/types";
import { voiceLabel } from "@/lib/research/voice";
import styles from "./ResearchScreen.module.css";

export interface TurnProps {
  turn: ResearchTurnWithCards;
  /** Render each attached proposition card (wired to state/actions by the screen). */
  renderCard: (card: ResearchTurnWithCards["cards"][number]) => ReactNode;
}

/**
 * One thread turn: 130px speaker cell (accent for the collaborator, faint for
 * the writer), flex:1 text at 20px/1.4/62ch with the writer's own lines at
 * weight 700, then any attached cards. README §Screen 2.2.
 */
export default function Turn({ turn, renderCard }: TurnProps) {
  const isYou = turn.side === "you";
  // UI-only voice relabel (features-plan F2a e): `who` is free text; any legacy
  // "Research" label shows as "Collaborator" without a data migration. The rule
  // is the pure `voiceLabel` helper (unit-tested + mutation-proven in isolation).
  const whoLabel = voiceLabel(turn.who);
  // A collaborator turn with no text yet is the streaming placeholder (before the
  // first delta). Show an animated "thinking" indicator so a 30s+ full-body web
  // read reads as working, not frozen. The writer's own turn always has text.
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
