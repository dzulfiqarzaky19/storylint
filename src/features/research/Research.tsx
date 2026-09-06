"use client";

import { useMemo, useReducer, useState, useTransition } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/navigation";
import type { ResearchProposition } from "@/lib/domain/types";
import {
  researchReducer,
  initResearchState,
} from "@/lib/state/researchStore";
import type { ResearchSnapshot } from "@/lib/db/research";
import {
  createThread,
  deleteThread,
  renameThread,
} from "@/lib/actions/research";
import Threads from "./Threads";
import Thread from "./Thread/Thread";
import type { PickerResult } from "@/lib/wiki/pickedTarget";
import { useResearchAsk } from "./hooks/useResearchAsk";
import { useResearchCommit } from "./hooks/useResearchCommit";
import { synthesizeResolvedTarget } from "@/lib/research/synthesizeResolvedTarget";
import { routeEnrichTarget } from "@/lib/research/resolveForEntry";
import Kept from "./Kept/Kept";
import type { KeptEntry } from "./Kept/Kept";
import styles from "./Research.module.css";

/** Minimal live-entry shape the enrich recommender + picker consume (F6). */
export interface EnrichEntry {
  id: string;
  name: string;
  kind: string;
  deletedAt: number | null;
}

export default function Research({
  snapshot,
  entries = [],
  categories = [],
  activeWorldId,
  activeWorldName,
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
  /** That world's display title, for the thread head's meta line. */
  activeWorldName?: string;
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
  const commit = useResearchCommit({ dispatch, worldId: activeWorldId });
  const [boardActive, setBoardActive] = useState(false);
  // The card currently being dragged, so the board drop knows what to keep.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // AI ask box (session-only) + the whole streaming ask lifecycle live in the
  // useResearchAsk engine (T-ARCH-14); this component only wires it to the view.
  const { draft, setDraft, asking, ask: askQuestion } = useResearchAsk(
    snapshot,
    activeWorldId,
    dispatch,
  );

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

  // ---- Handlers. The screen states intent; pairing lives in commit. ------

  const handleKeep = (id: string, next: boolean) => {
    commit({ type: "card.keep", propositionId: id, kept: next });
  };

  const handlePropose = (id: string) => {
    commit({ type: "card.propose", propositionId: id });
  };

  const handleCancel = () => {
    commit({ type: "card.cancel" });
  };

  // The modal's confirm IS the wiki-write gate (product rule 1). What the writer
  // confirmed, plus the card it came from, is the whole story: the id scheme,
  // the category-before-entry ordering, the removed-target rejection and the
  // flip of this card to "in the wiki" all live in writeConfirmedTarget, shared
  // verbatim with /write. The screen no longer spells that envelope.
  const handleConfirm = (result: PickerResult) => {
    if (!pendingCard) return;
    commit({
      type: "card.confirm",
      propositionId: pendingCard.id,
      result,
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
  // Confirmation happens in Threads. The last-thread floor lives in
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
        <Threads
          threads={snapshot.threads}
          selectedId={snapshot.threadId}
          onSelect={selectThread}
          onCreate={addThread}
          onDelete={removeThread}
          onRename={renameThreadTitle}
        />
        <Thread
          question={state.question}
          worldName={activeWorldName}
          visibleTurns={visibleTurns}
          keptSet={keptSet}
          inWikiSet={inWikiSet}
          focusPropositionId={focusPropositionId}
          pendingCard={pendingCard}
          resolvedTarget={resolvedTarget}
          categories={categories}
          entries={entries.map((e) => ({ id: e.id, name: e.name, kind: e.kind }))}
          error={state.error}
          draft={draft}
          asking={asking}
          onKeep={handleKeep}
          onPropose={handlePropose}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onDismissError={() => dispatch({ type: "SET_ERROR", error: null })}
          onDraftChange={setDraft}
          onAsk={handleAsk}
          onChip={handleChip}
          onDragStart={setDraggingId}
          onDragEnd={() => {
            setDraggingId(null);
            setBoardActive(false);
          }}
        />

        <Kept
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
