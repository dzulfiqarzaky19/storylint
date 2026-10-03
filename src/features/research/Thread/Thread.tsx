"use client";

import type { ResearchProposition, ResearchTurnWithCards } from "@/domain/types";
import type { ResolvedTarget } from "@/domain/check";
import type { PickerResult } from "@/domain/wiki/pickedTarget";
import WikiTargetPicker from "@/components/WikiTargetPicker";
import Question from "./Question";
import Turn from "./Turn";
import Proposition from "./Proposition";
import Composer from "./Composer/Composer";
import PromptChip from "./Composer/PromptChip";
import styles from "./Thread.module.css";

const CHIPS = [
  "Give me a scene",
  "I’m stuck — ask me something",
];

const EMPTY_GUIDANCE =
  "Ask me anything about your story. I draw on your entire wiki to answer, " +
  "so just start typing a question.";

export interface ThreadProps {
  question: string;
  worldName?: string;
  visibleTurns: ResearchTurnWithCards[];
  keptSet: Set<string>;
  inWikiSet: Set<string>;
  focusPropositionId?: string;
  pendingCard: ResearchProposition | undefined;
  resolvedTarget: ResolvedTarget | null;
  categories: { id: string; label: string }[];
  entries: { id: string; name: string; kind: string }[];
  error: string | null;
  draft: string;
  asking: boolean;
  onKeep: (id: string, next: boolean) => void;
  onPropose: (id: string) => void;
  onConfirm: (result: PickerResult) => void;
  onCancel: () => void;
  onDismissError: () => void;
  onDraftChange: (value: string) => void;
  onAsk: () => void;
  onChip: (label: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

export default function Thread({
  question,
  worldName,
  visibleTurns,
  keptSet,
  inWikiSet,
  focusPropositionId,
  pendingCard,
  resolvedTarget,
  categories,
  entries,
  error,
  draft,
  asking,
  onKeep,
  onPropose,
  onConfirm,
  onCancel,
  onDismissError,
  onDraftChange,
  onAsk,
  onChip,
  onDragStart,
  onDragEnd,
}: ThreadProps) {
  return (
    <main className={styles.body}>
      {visibleTurns.length > 0 && (
        <Question
          question={question}
          turnCount={visibleTurns.length}
          worldName={worldName}
        />
      )}
      <div className={styles.chatScroll}>
      {visibleTurns.length === 0 ? (
        <section className={styles.thread}>
          <p className={styles.guidance}>{EMPTY_GUIDANCE}</p>
        </section>
      ) : (
        <>
          <section className={styles.thread}>
            {visibleTurns.map((turn) => (
          <Turn
            key={turn.id}
            turn={turn}
            renderCard={(card) => (
              <Proposition
                key={card.id}
                card={card}
                kept={keptSet.has(card.id)}
                inWiki={inWikiSet.has(card.id)}
                focused={card.id === focusPropositionId}
                onKeep={onKeep}
                onPropose={onPropose}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            )}
          />
            ))}
          </section>
        </>
      )}
      </div>

      {pendingCard && resolvedTarget && (
        <WikiTargetPicker
          resolvedTarget={resolvedTarget}
          categories={categories}
          entries={entries}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}

      <section className={styles.footer}>
        {error && (
          <div className={styles.errorBar} role="alert" aria-live="assertive">
            <span className={styles.errorText}>{error}</span>
            <button
              type="button"
              className={styles.errorDismiss}
              onClick={onDismissError}
            >
              Dismiss
            </button>
          </div>
        )}
        <Composer
          ai={{
            value: draft,
            onChange: onDraftChange,
            onSubmit: onAsk,
            busy: asking,
          }}
        >
          {CHIPS.map((label) => (
            <PromptChip
              key={label}
              label={label}
              onClick={() => onChip(label)}
            />
          ))}
        </Composer>
      </section>
    </main>
  );
}
