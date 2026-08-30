"use client";

import { useMemo, useReducer, useRef, useState, useTransition } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/navigation";
import type { Shelf, ResearchProposition, ResearchTurnWithCards } from "@/lib/domain/types";
import {
  researchReducer,
  initResearchState,
} from "@/lib/state/researchStore";
import type { ResearchSnapshot } from "@/lib/db/research";
import { readResearchStream } from "@/lib/research/readStream";
import { decideStreamEnd } from "@/lib/research/decideStreamEnd";
import {
  keepCard,
  proposeCard,
  cancelPending,
  confirmCard,
  createThread,
  deleteThread,
  renameThread,
} from "@/lib/actions/research";
import ResearchIndex from "./ResearchIndex";
import QuestionBlock from "./QuestionBlock";
import Turn from "./Turn";
import PropositionCard from "./PropositionCard";
import WikiTargetPicker from "@/components/wiki/WikiTargetPicker";
import type { PickerResult } from "@/lib/research/resolvePickerTarget";
import { resolvePickerTarget } from "@/lib/research/resolvePickerTarget";
import { createCategory } from "@/lib/actions/wiki";
import { defaultCategoryShelf } from "@/lib/wiki/categoryLabels";
import { synthesizeResolvedTarget } from "@/lib/research/synthesizeResolvedTarget";
import { routeEnrichTarget } from "@/lib/research/resolveForEntry";
import Composer from "./Composer";
import PromptChip from "./PromptChip";
import KeptBoard from "./KeptBoard";
import type { KeptEntry } from "./KeptBoard";
import styles from "./ResearchScreen.module.css";

// Prompt chips. Each chip's label is sent verbatim as a REAL question to the
// AI (same path as the ask box) — no pre-written seed turns. Curly apostrophe
// on the last one.
const CHIPS = [
  "Give me a scene",
  "I’m stuck — ask me something",
];

// Empty-state guidance shown when a thread has no turns yet (a brand-new thread,
// or the whole screen when there are no threads at all). Replaces the old
// pre-written seed conversation: research now starts empty and every turn is a
// real AI exchange. The AI always draws on the ENTIRE wiki — no scope to pick.
const EMPTY_GUIDANCE =
  "Ask me anything about your story. I draw on your entire wiki to answer, " +
  "so just start typing a question.";

/** Minimal live-entry shape the enrich recommender + picker consume (F6). */
export interface EnrichEntry {
  id: string;
  name: string;
  kind: string;
  deletedAt: number | null;
}

export default function ResearchScreen({
  snapshot,
  entries = [],
  categories = [],
  activeWorldId,
  worldKept = [],
  focusPropositionId,
}: {
  snapshot: ResearchSnapshot;
  /** Live wiki entries (deleted-filtered) for enrich-vs-duplicate. */
  entries?: EnrichEntry[];
  /** Live categories for the wiki-target picker pills (built-ins + user rows). */
  categories?: { id: string; label: string }[];
  /**
   * TCK-E06: the world the writer is viewing. Threaded into confirmCard so a
   * newly-minted entry is linked into this world (else it is invisible on /wiki).
   */
  activeWorldId: string;
  /**
   * T-RES-E2E-KEPT: every kept card in the ACTIVE world, with its source thread.
   * The Kept board is WORLD-WIDE — it aggregates kept propositions across every
   * thread in the world, not just the open thread — so it seeds from this
   * server-loaded list rather than from the open thread's cards alone.
   */
  worldKept?: import("@/lib/domain/types").WorldKeptCardRow[];
  /**
   * A Kept-board click-through targets one card by id (via ?focus=). The matching
   * proposition in the opened thread renders data-card-focused="true".
   */
  focusPropositionId?: string;
}) {
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
  // Synchronous re-entrancy guard. `asking` is React state, so two calls fired
  // in the same tick (a double-invoked event / a StrictMode transition replay)
  // both read `asking === false` before either commits, and the question is
  // POSTed and persisted TWICE. This ref flips synchronously so the second call
  // returns immediately. Reset in askQuestion's finally, same as `asking`.
  const askInFlight = useRef(false);

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

  // A card written INTO the wiki leaves the Kept board — Kept is the holding
  // area for propositions NOT yet in the wiki, so once one lands (inWiki) it
  // drops off rather than lingering with an "in the wiki" badge.
  //
  // The board is WORLD-WIDE: it seeds from `worldKept` (every kept card in the
  // active world, with source-thread attribution) so a card kept in thread A is
  // still on the board while thread B is open. Session keeps made in THIS thread
  // (optimistic, not yet in the server-loaded list) are merged in on top and
  // attributed to the active thread, so a fresh Keep shows immediately without a
  // round-trip. A card written into the wiki (inWiki) drops off either source.
  const activeThreadTitle =
    snapshot.threads.find((t) => t.id === snapshot.threadId)?.title ?? "this thread";
  const worldEntries: KeptEntry[] = worldKept
    .filter((c) => !c.inWiki && !inWikiSet.has(c.propositionId))
    .map((c) => ({
      id: c.propositionId,
      kind: c.kind,
      title: c.title,
      threadId: c.threadId,
      threadTitle: c.threadTitle,
    }));
  const worldKeptIds = new Set(worldEntries.map((e) => e.id));
  const sessionEntries: KeptEntry[] = state.keptIds
    .filter((id) => !inWikiSet.has(id) && !worldKeptIds.has(id))
    .map((id) => cardById.get(id))
    .filter((c): c is ResearchProposition => Boolean(c))
    .map((c) => ({
      id: c.id,
      kind: c.kind,
      title: c.title,
      threadId: snapshot.threadId,
      threadTitle: activeThreadTitle,
    }));
  const keptItems: KeptEntry[] = [...worldEntries, ...sessionEntries];

  const pendingCard = state.pendingPropositionId
    ? cardById.get(state.pendingPropositionId)
    : undefined;

  // F6 / TCK-021 enrich-vs-duplicate routing. The AI's EXPLICIT pick wins:
  // resolveForEntry honors `pendingCard.forEntry` (the exact name of a live entry
  // the card is ABOUT) and, on a match, routes there. Only when the AI gave no
  // usable hint (absent/blank name, or it names no live entry) do we fall back to
  // the title-guessing recommender. Both return the same EnrichRecommendation
  // shape, so the confirm strip's "Add to <entry>" path is reused unchanged.
  const enrichRecommendation = useMemo(
    () =>
      pendingCard
        ? routeEnrichTarget(
            {
              forEntry: pendingCard.forEntry,
              title: pendingCard.title,
              body: pendingCard.body,
            },
            entries,
          )
        : null,
    [pendingCard, entries],
  );

  // T-WRITE-WIKI-MODAL (slice C): the modal is producer-agnostic — it consumes a
  // ResolvedTarget default. /research has no check Mark to read one off, so we
  // synthesize the same shape from the pending card + the F6 recommendation
  // (enrich when one matched, else propose-by-name mint). On /write (slice A) a
  // real Mark supplies this instead. Null until a card is pending (modal closed).
  const resolvedTarget = useMemo(
    () =>
      pendingCard
        ? synthesizeResolvedTarget(
            {
              title: pendingCard.title,
              body: pendingCard.body,
              asKind: pendingCard.asKind,
            },
            enrichRecommendation,
          )
        : null,
    [pendingCard, enrichRecommendation],
  );

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

  // The modal's confirm IS the wiki-write gate (product rule 1). Its PickerResult
  // maps to confirmCard's EXISTING arguments via the pure resolvePickerTarget —
  // the write contract is reused unchanged. ENRICH vs MINT is carried solely by
  // whether the writer landed on an existing entry (result.entryId set).
  const handleConfirm = (result: PickerResult) => {
    if (!pendingCard) return;
    const card = pendingCard;
    const args = resolvePickerTarget(result);
    // Enrich -> the existing entry's id; mint -> the derived prop- id. This is the
    // id the optimistic reducer flips to in_wiki, matching confirmCard's return.
    const entryId = args.enrichEntryId ?? `prop-${card.id}`;
    // Optimistic: reflect the write locally (kept + inWiki, modal closes).
    dispatch({ type: "CONFIRM_CARD", propositionId: card.id, entryId });
    // A brand-new category is a real categories row: mint it FIRST, then hand
    // confirmCard the created {id, shelf} so the entry's kind is that real
    // category (not the lore fallback). The proposed NAME's presence is what
    // routes to a category mint - no separate flag.
    const newCategoryName = result.proposeCategoryName?.trim();
    runAction(async () => {
      let category: { id: string; shelf: Shelf } | undefined;
      if (newCategoryName) {
        // A stable id keyed to the card makes the mint idempotent: React strict
        // mode (and any double-fire / retry) invokes this twice, and createCategory
        // ON CONFLICT collapses the second into the first instead of minting a
        // duplicate category row. A fresh randomUUID() per call would defeat that.
        const created = await createCategory({
          id: `cat-${card.id}`,
          label: newCategoryName,
          shelf: defaultCategoryShelf(),
        });
        if (!created.ok) return created;
        category = { id: created.data.id, shelf: created.data.shelf as Shelf };
      }
      return confirmCard({
        propositionId: card.id,
        entry: args.entry,
        enrichEntryId: args.enrichEntryId,
        worldId: activeWorldId,
        category,
        confirmed: true,
      });
    });
  };

  // ---- AI ask (STREAMING; persists you+them turns on stream-complete) --------
  // POST to /api/research/stream: append two placeholder turns immediately, grow
  // the answer placeholder as `delta` frames arrive, then RECONCILE both turns to
  // the server-persisted ones on `done`. On error / abort the server persisted
  // NOTHING, so we roll the placeholders back. The reducer stays the sole owner
  // of turns; this only dispatches the streaming actions in order.
  //
  // `askQuestion` is the single real-AI entry point. Both the ask box
  // (`handleAsk`) and every prompt chip (`handleChip`) call it with the
  // question text — a chip's label IS its question. There are no pre-written
  // seed turns; a chip is just a shortcut for typing that text and asking.
  const askQuestion = (question: string) => {
    if (!question || asking || askInFlight.current) return;
    askInFlight.current = true;
    setAsking(true);

    // Client-side placeholder ids. The server generates its OWN real ids and
    // returns the persisted turns in `done`; RECONCILE_TURN remaps these temp
    // ids to the persisted ids (and folds any card kept/inWiki flags).
    // `askQuestion` runs only on a user action (ask box submit / prompt chip),
    // never during render, so a one-off `Date.now()` temp id is intentional and
    // stable for this call (same pattern as WikiScreen's handler id-gen).
    // eslint-disable-next-line react-hooks/purity
    const stamp = Date.now();
    const tempYouId = `stream-you-${stamp}`;
    const tempThemId = `stream-them-${stamp}`;
    const threadId = snapshot.threadId;

    const youPlaceholder: ResearchTurnWithCards = {
      id: tempYouId,
      threadId,
      ordinal: -1,
      side: "you",
      who: "You",
      text: question,
      cards: [],
    };
    const themPlaceholder: ResearchTurnWithCards = {
      id: tempThemId,
      threadId,
      ordinal: -1,
      side: "them",
      who: "Collaborator",
      text: "",
      cards: [],
    };

    dispatch({ type: "APPEND_STREAMING_TURN", turns: [youPlaceholder, themPlaceholder] });
    setDraft("");

    startTransition(async () => {
      let reconciled = false;
      let sawError = false;
      try {
        // T-RESEARCH-1: with NO active thread (an empty research surface), the
        // first question auto-creates a default thread in the ACTIVE world and
        // asks against it — instead of erroring "No active thread". createThread
        // returns the real id; we chat against it now and sync the URL AFTER the
        // exchange persists (a mid-stream router.push would remount and abort it).
        let activeThreadId = threadId;
        let createdThreadId: string | null = null;
        if (!activeThreadId) {
          const created = await createThread({ worldId: activeWorldId });
          if (!created.ok) throw new Error(created.error ?? "Could not start a thread.");
          activeThreadId = created.data.threadId;
          createdThreadId = created.data.threadId;
        }
        const res = await fetch("/api/research/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question,
            threadId: activeThreadId,
            // A pre-existing thread carries its title (memory/auto-title); an
            // auto-created thread has none yet, so send undefined and let the
            // route derive it from this first question.
            threadTitle: createdThreadId
              ? undefined
              : snapshot.threads.find((t) => t.id === activeThreadId)?.title,
          }),
        });

        if (!res.ok || !res.body) {
          let message = "The AI stream failed to start.";
          try {
            const body = (await res.json()) as { error?: string };
            if (body.error) message = body.error;
          } catch {
            /* non-JSON error body */
          }
          throw new Error(message);
        }

        await readResearchStream(res.body.getReader(), {
          onDelta: (text) => {
            dispatch({ type: "STREAM_DELTA", turnId: tempThemId, text });
          },
          onDone: (turns) => {
            // Reconcile in order: [youPersisted, themPersisted].
            const [youTurn, themTurn] = turns;
            if (youTurn) dispatch({ type: "RECONCILE_TURN", tempTurnId: tempYouId, turn: youTurn });
            if (themTurn) {
              dispatch({ type: "RECONCILE_TURN", tempTurnId: tempThemId, turn: themTurn });
            }
            reconciled = true;
            // T-RESEARCH-1: now that the auto-created thread has a persisted turn,
            // point the URL at it so the rail selects it and a refresh keeps it.
            if (createdThreadId) {
              router.push(`/research?thread=${encodeURIComponent(createdThreadId)}`);
            }
          },
          onError: (message) => {
            dispatch({ type: "SET_ERROR", error: message });
            sawError = true;
          },
        });

        // No `done` frame => nothing was persisted; drop the placeholders.
        if (!reconciled) {
          dispatch({ type: "ROLLBACK_STREAMING_TURN", turnIds: [tempYouId, tempThemId] });
          // A stream can close with NO terminal frame at all (slow/aborted
          // gateway, dropped connection). Without this the user saw the turn
          // vanish silently. `decideStreamEnd` surfaces a retry-oriented error
          // and restores the draft ONLY for that case, and never clobbers an
          // error the route already reported via `onError`.
          const decision = decideStreamEnd({ reconciled, sawError, question });
          if (decision.setError !== undefined) {
            dispatch({ type: "SET_ERROR", error: decision.setError });
          }
          if (decision.restoreDraft !== undefined) {
            setDraft(decision.restoreDraft);
          }
        }
      } catch (err) {
        // Transport failure / abort: the server persisted nothing, so remove the
        // placeholders and surface the error.
        dispatch({ type: "ROLLBACK_STREAMING_TURN", turnIds: [tempYouId, tempThemId] });
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        askInFlight.current = false;
        setAsking(false);
      }
    });
  };

  // Ask box: send the trimmed draft as the question.
  const handleAsk = () => askQuestion(draft.trim());

  // Prompt chip: send the chip's label verbatim as a real question.
  const handleChip = (label: string) => askQuestion(label);

  // ---- Thread navigation (Track B) — URL-driven -----------------------------
  const selectThread = (id: string) => {
    if (id === snapshot.threadId) return;
    router.push(`/research?thread=${encodeURIComponent(id)}`);
  };

  // Kept click-through: open the item's SOURCE thread and focus its origin card.
  // The focus target rides the URL (?focus=) so it survives the navigation and
  // re-render — the opened thread's matching card renders data-card-focused.
  const openKeptItem = (item: KeptEntry) => {
    router.push(
      `/research?thread=${encodeURIComponent(item.threadId)}&focus=${encodeURIComponent(item.id)}`,
    );
  };
  const addThread = () => {
    startTransition(async () => {
      // T-RESEARCH-2: stamp the new thread with the world the writer is viewing,
      // so it lands in THIS world's rail rather than the default world.
      const res = await createThread({ worldId: activeWorldId });
      if (res.ok) {
        router.push(`/research?thread=${encodeURIComponent(res.data.threadId)}`);
      } else {
        dispatch({ type: "SET_ERROR", error: res.error });
      }
    });
  };

  // Hard-delete a thread. When the ACTIVE thread is deleted we jump to the
  // nearest remaining thread (prefer the next one, else the previous).
  // Deleting a non-active thread just refreshes the list in place.
  // Confirmation happens in ResearchIndex. The last-thread floor lives in
  // deleteLastThreadGuarded — a world's only thread is refused, so this
  // handler never reopens via createThread (that branch was dead).
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
        return;
      }
      // R3 floor refuses emptying a world, so ok+no-sibling is a race. Refresh
      // rather than mint a thread the writer did not ask for.
      router.refresh();
    });
  };

  // Rename a thread from the rail. The title lives in the server-rendered
  // snapshot, so refresh after the write to re-render the row with the new name
  // (mirrors removeThread's non-active refresh path).
  const renameThreadTitle = (id: string, title: string) => {
    startTransition(async () => {
      const res = await renameThread({ threadId: id, title });
      if (res.ok) {
        router.refresh();
      } else {
        dispatch({ type: "SET_ERROR", error: res.error });
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
          onRename={renameThreadTitle}
        />
        <main className={styles.body}>
          {visibleTurns.length === 0 ? (
            <section className={styles.thread}>
              <p className={styles.guidance}>{EMPTY_GUIDANCE}</p>
            </section>
          ) : (
            <>
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
                    focused={card.id === focusPropositionId}
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
            </>
          )}

          {pendingCard && resolvedTarget && (
            <WikiTargetPicker
              resolvedTarget={resolvedTarget}
              categories={categories}
              entries={entries.map((e) => ({ id: e.id, name: e.name, kind: e.kind }))}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          )}

          <section className={styles.footer}>
            {state.error && (
              <div className={styles.errorBar} role="alert" aria-live="assertive">
                <span className={styles.errorText}>{state.error}</span>
                <button
                  type="button"
                  className={styles.errorDismiss}
                  onClick={() => dispatch({ type: "SET_ERROR", error: null })}
                >
                  Dismiss
                </button>
              </div>
            )}
            <Composer
              ai={{
                value: draft,
                onChange: setDraft,
                onSubmit: handleAsk,
                busy: asking,
              }}
            >
              {CHIPS.map((label) => (
                <PromptChip
                  key={label}
                  label={label}
                  onClick={() => handleChip(label)}
                />
              ))}
            </Composer>
          </section>

        </main>

        <KeptBoard
          items={keptItems}
          active={boardActive}
          onDragOver={onBoardDragOver}
          onDragLeave={onBoardDragLeave}
          onDrop={onBoardDrop}
          onOpenItem={openKeptItem}
        />
      </div>
    </div>
  );
}
