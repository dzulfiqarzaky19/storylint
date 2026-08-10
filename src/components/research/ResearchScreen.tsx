"use client";

import { useMemo, useReducer, useState, useTransition } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/navigation";
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
  createThread,
  deleteThread,
  askResearchAi,
} from "@/lib/actions/research";
import ResearchIndex from "./ResearchIndex";
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
  const router = useRouter();
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
  // AI ask box (session-only). `asking` disables the input while a call is out.
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);

  // Lookup of every proposition by id (across all turns, incl. AI-appended)
  // for the Kept board. Derived from reducer state so AI cards are findable.
  const cardById = useMemo(() => {
    const map = new Map<string, ResearchProposition>();
    for (const turn of state.turns) {
      for (const card of turn.cards) map.set(card.id, card);
    }
    return map;
  }, [state.turns]);

  const keptSet = useMemo(() => new Set(state.keptIds), [state.keptIds]);
  const inWikiSet = useMemo(() => new Set(state.inWikiIds), [state.inWikiIds]);
  const visibleSet = useMemo(
    () => new Set(state.visibleTurnIds),
    [state.visibleTurnIds],
  );

  const visibleTurns = state.turns.filter((t) => visibleSet.has(t.id));

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

  // ---- AI ask (persists you+them turns; grounded on the wiki, no wiki write) --
  const handleAsk = () => {
    const question = draft.trim();
    if (!question || asking) return;
    setAsking(true);
    startTransition(async () => {
      try {
        const res = await askResearchAi({
          question,
          threadId: snapshot.threadId,
          threadTitle: snapshot.threads.find((t) => t.id === snapshot.threadId)?.title,
        });
        if (res.ok) {
          dispatch({ type: "APPEND_TURN", turns: res.data.turns });
          setDraft("");
        } else {
          dispatch({ type: "SET_ERROR", error: res.error });
        }
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setAsking(false);
      }
    });
  };

  // ---- Thread navigation (Track B) — URL-driven -----------------------------
  const selectThread = (id: string) => {
    if (id === snapshot.threadId) return;
    router.push(`/research?thread=${encodeURIComponent(id)}`);
  };
  const addThread = () => {
    startTransition(async () => {
      const res = await createThread();
      if (res.ok) {
        router.push(`/research?thread=${encodeURIComponent(res.data.threadId)}`);
      } else {
        dispatch({ type: "SET_ERROR", error: res.error });
      }
    });
  };

  // Hard-delete a thread. When the ACTIVE thread is deleted we jump to the
  // nearest remaining thread (prefer the next one, else the previous); if none
  // remain we open a fresh empty thread. Deleting a non-active thread just
  // refreshes the list in place. Confirmation happens in ResearchIndex.
  const removeThread = (id: string) => {
    const threads = snapshot.threads;
    const idx = threads.findIndex((t) => t.id === id);
    const remaining = threads.filter((t) => t.id !== id);
    const wasActive = id === snapshot.threadId;
    const nextActive =
      idx >= 0 ? (remaining[idx] ?? remaining[idx - 1] ?? null) : null;
    startTransition(async () => {
      const res = await deleteThread({ threadId: id });
      if (!res.ok) {
        dispatch({ type: "SET_ERROR", error: res.error });
        return;
      }
      if (!wasActive) {
        router.refresh();
        return;
      }
      if (nextActive) {
        router.push(`/research?thread=${encodeURIComponent(nextActive.id)}`);
      } else {
        const created = await createThread();
        if (created.ok) {
          router.push(
            `/research?thread=${encodeURIComponent(created.data.threadId)}`,
          );
        } else {
          dispatch({ type: "SET_ERROR", error: created.error });
        }
      }
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
    <div className={styles.screen}>
      <div className={styles.layout}>
        <ResearchIndex
          threads={snapshot.threads}
          selectedId={snapshot.threadId}
          onSelect={selectThread}
          onCreate={addThread}
          onDelete={removeThread}
        />
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
            <Composer
              ai={{
                value: draft,
                onChange: setDraft,
                onSubmit: handleAsk,
                busy: asking,
              }}
            >
              {CHIPS.map((label) => (
                <PromptChip key={label} label={label} onClick={handleChip} />
              ))}
            </Composer>
          </section>

          <div className={styles.bottomSpacer} />
        </main>

        <KeptBoard
          items={keptItems}
          active={boardActive}
          onDragOver={onBoardDragOver}
          onDragLeave={onBoardDragLeave}
          onDrop={onBoardDrop}
        />
      </div>
    </div>
  );
}
