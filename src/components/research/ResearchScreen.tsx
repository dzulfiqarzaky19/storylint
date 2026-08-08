"use client";

import { useMemo, useReducer, useState, useTransition } from "react";
import type { DragEvent } from "react";
import type { Kind, ResearchProposition } from "@/lib/domain/types";
import {
  researchReducer,
  initResearchState,
} from "@/lib/state/researchStore";
import type { ResearchSnapshot } from "@/lib/db/research";
import {
  advanceTurn,
  keepCard,
  proposeCard,
  cancelPending,
  confirmCard,
} from "@/lib/actions/research";
import QuestionBlock from "./QuestionBlock";
import Turn from "./Turn";
import PropositionCard from "./PropositionCard";
import ConfirmationStrip from "./ConfirmationStrip";
import Composer from "./Composer";
import PromptChip from "./PromptChip";
import KeptBoard from "./KeptBoard";
import type { KeptEntry } from "./KeptBoard";
import styles from "./ResearchScreen.module.css";

// Prompt chips (HANDOFF §6). Verbatim, curly apostrophe on the last one.
const CHIPS = [
  "Push on that",
  "What does it cost her?",
  "Give me a scene",
  "I’m stuck — ask me something",
];

const VALID_KINDS: readonly Kind[] = ["character", "world", "organization", "lore"];

/**
 * Map a proposition's `asKind` to a wiki entry Kind. Non-entry kinds (`beat`,
 * `question`) become `lore` entries — the confirmation strip lets the writer
 * edit every field afterward (per the sentence copy).
 */
function toEntryKind(asKind: string): Kind {
  return (VALID_KINDS as readonly string[]).includes(asKind)
    ? (asKind as Kind)
    : "lore";
}

export default function ResearchScreen({ snapshot }: { snapshot: ResearchSnapshot }) {
  const [state, dispatch] = useReducer(
    researchReducer,
    {
      question: snapshot.question,
      turns: snapshot.turns,
      initialVisibleTurnIds: snapshot.initialVisibleTurnIds,
    },
    initResearchState,
  );
  const [, startTransition] = useTransition();
  const [boardActive, setBoardActive] = useState(false);
  // The card currently being dragged, so the board drop knows what to keep.
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Lookup of every proposition by id (across all turns) for the Kept board.
  const cardById = useMemo(() => {
    const map = new Map<string, ResearchProposition>();
    for (const turn of snapshot.turns) {
      for (const card of turn.cards) map.set(card.id, card);
    }
    return map;
  }, [snapshot.turns]);

  const keptSet = useMemo(() => new Set(state.keptIds), [state.keptIds]);
  const inWikiSet = useMemo(() => new Set(state.inWikiIds), [state.inWikiIds]);
  const visibleSet = useMemo(
    () => new Set(state.visibleTurnIds),
    [state.visibleTurnIds],
  );

  const visibleTurns = snapshot.turns.filter((t) => visibleSet.has(t.id));

  const keptItems: KeptEntry[] = state.keptIds
    .map((id) => cardById.get(id))
    .filter((c): c is ResearchProposition => Boolean(c))
    .map((c) => ({
      id: c.id,
      kind: c.kind,
      title: c.title,
      inWiki: inWikiSet.has(c.id),
    }));

  const pendingCard = state.pendingPropositionId
    ? cardById.get(state.pendingPropositionId)
    : undefined;

  // ---- Handlers (reducer fires immediately; server action alongside) ------

  const runAction = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) dispatch({ type: "SET_ERROR", error: res.error ?? "Write failed" });
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  };

  const handleKeep = (id: string, next: boolean) => {
    dispatch({ type: "KEEP_CARD", propositionId: id, kept: next });
    runAction(() => keepCard(id, next));
  };

  const handlePropose = (id: string) => {
    dispatch({ type: "PROPOSE_CARD", propositionId: id });
    runAction(() => proposeCard(id));
  };

  const handleCancel = () => {
    dispatch({ type: "CANCEL_PENDING" });
    runAction(() => cancelPending());
  };

  const handleConfirm = () => {
    if (!pendingCard) return;
    const card = pendingCard;
    const entryId = `prop-${card.id}`;
    // Optimistic: reflect the write locally (kept + inWiki, strip closes).
    dispatch({ type: "CONFIRM_CARD", propositionId: card.id, entryId });
    runAction(() =>
      confirmCard({
        propositionId: card.id,
        entry: {
          name: card.title,
          kind: toEntryKind(card.asKind),
          summary: card.body,
        },
        confirmed: true,
      }),
    );
  };

  const handleChip = () => {
    const hidden = snapshot.turns
      .filter((t) => !visibleSet.has(t.id))
      .map((t) => t.id);
    if (hidden.length === 0) return;
    dispatch({ type: "ADVANCE_TURN", revealedTurnIds: hidden });
    runAction(async () => {
      const res = await advanceTurn(hidden);
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    });
  };

  // ---- Drag-to-board (drop equals Keep) -----------------------------------

  const onBoardDragOver = (ev: DragEvent<HTMLDivElement>) => {
    if (draggingId) {
      ev.preventDefault();
      if (!boardActive) setBoardActive(true);
    }
  };
  const onBoardDragLeave = (ev: DragEvent<HTMLDivElement>) => {
    // Only clear when leaving the board wrapper itself, not its children.
    if (ev.currentTarget === ev.target) setBoardActive(false);
  };
  const onBoardDrop = (ev: DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    const id = draggingId;
    setBoardActive(false);
    setDraggingId(null);
    if (id && !keptSet.has(id)) handleKeep(id, true);
  };

  return (
    <main className={styles.body}>
      <QuestionBlock question={state.question} />

      <section className={styles.thread}>
        {visibleTurns.map((turn) => (
          <Turn
            key={turn.id}
            turn={turn}
            renderCard={(card) => (
              <PropositionCard
                key={card.id}
                card={card}
                kept={keptSet.has(card.id)}
                inWiki={inWikiSet.has(card.id)}
                onKeep={handleKeep}
                onPropose={handlePropose}
                onDragStart={setDraggingId}
                onDragEnd={() => {
                  setDraggingId(null);
                  setBoardActive(false);
                }}
              />
            )}
          />
        ))}
      </section>

      {pendingCard && (
        <ConfirmationStrip
          title={pendingCard.title}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      <section className={styles.footer}>
        <Composer>
          {CHIPS.map((label) => (
            <PromptChip key={label} label={label} onClick={handleChip} />
          ))}
        </Composer>
        <KeptBoard
          items={keptItems}
          active={boardActive}
          onDragOver={onBoardDragOver}
          onDragLeave={onBoardDragLeave}
          onDrop={onBoardDrop}
        />
      </section>

      <div className={styles.bottomSpacer} />
    </main>
  );
}
