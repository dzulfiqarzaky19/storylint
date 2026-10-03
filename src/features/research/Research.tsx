"use client";

import { useMemo, useReducer, useState, useTransition } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/navigation";
import type { ResearchProposition } from "@/domain/types";
import {
  researchReducer,
  initResearchState,
} from "@/features/research/state/researchStore";
import type { ResearchSnapshot } from "@/domain/types";
import { createThread, deleteThread, renameThread } from "@/server/actions/research/threads";
import Threads from "./Threads";
import Thread from "./Thread/Thread";
import type { PickerResult } from "@/domain/wiki/pickedTarget";
import { useResearchAsk } from "./hooks/useResearchAsk";
import { useResearchCommit } from "./hooks/useResearchCommit";
import { synthesizeResolvedTarget } from "@/features/research/lib/synthesizeResolvedTarget";
import { routeEnrichTarget } from "@/features/research/lib/resolveForEntry";
import Kept from "./Kept/Kept";
import type { KeptEntry } from "./Kept/Kept";
import styles from "./Research.module.css";

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
  entries?: EnrichEntry[];
  categories?: { id: string; label: string }[];
  activeWorldId: string;
  activeWorldName?: string;
  worldKept?: import("@/domain/types").WorldKeptCardRow[];
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { draft, setDraft, asking, ask: askQuestion } = useResearchAsk(
    snapshot,
    activeWorldId,
    dispatch,
  );

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

  const handleKeep = (id: string, next: boolean) => {
    commit({ type: "card.keep", propositionId: id, kept: next });
  };

  const handlePropose = (id: string) => {
    commit({ type: "card.propose", propositionId: id });
  };

  const handleCancel = () => {
    commit({ type: "card.cancel" });
  };

  const handleConfirm = (result: PickerResult) => {
    if (!pendingCard) return;
    commit({
      type: "card.confirm",
      propositionId: pendingCard.id,
      result,
    });
  };

  const handleAsk = () => askQuestion(draft.trim());

  const handleChip = (label: string) => askQuestion(label);

  const selectThread = (id: string) => {
    if (id === snapshot.threadId) return;
    router.push(`/research?thread=${encodeURIComponent(id)}`);
  };

  const openKeptItem = (item: KeptEntry) => {
    router.push(
      `/research?thread=${encodeURIComponent(item.threadId)}&focus=${encodeURIComponent(item.id)}`,
    );
  };
  const addThread = () => {
    startTransition(async () => {
      const res = await createThread({ worldId: activeWorldId });
      if (res.ok) {
        router.push(`/research?thread=${encodeURIComponent(res.data.threadId)}`);
      } else {
        dispatch({ type: "SET_ERROR", error: res.error });
      }
    });
  };

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
      router.refresh();
    });
  };

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

  const onBoardDragOver = (ev: DragEvent<HTMLDivElement>) => {
    if (draggingId) {
      ev.preventDefault();
      if (!boardActive) setBoardActive(true);
    }
  };
  const onBoardDragLeave = (ev: DragEvent<HTMLDivElement>) => {
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
