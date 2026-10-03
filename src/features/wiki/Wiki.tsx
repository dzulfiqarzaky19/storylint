"use client";

import { useReducer, useCallback, useState } from "react";
import { useAiSuggest } from "./hooks/useAiSuggest";
import { useTrashPanel } from "./Sidebar/hooks/useTrashPanel";
import type { WikiSnapshot, Shelf as ShelfKey, EntryWithDetails, Kind, WikiSuggestion } from "@/domain/types";
import { KIND_SHELF } from "@/domain/types";
import {
  initWikiState,
  wikiReducer,
} from "@/features/wiki/state";
import { DragProvider, useDrag } from "@/features/wiki/dnd/DragContext";
import { useWikiCommit } from "./hooks/useWikiCommit";
import { categoryLabelById } from "@/domain/wiki/categoryLabels";
import Sidebar from "./Sidebar/Sidebar";
import TrashPanel from "./Sidebar/TrashPanel";
import Main from "./Main/Main";
import styles from "./Wiki.module.css";

const SHELF_ORDER: ShelfKey[] = ["people", "places", "orders", "lore"];

interface WikiProps {
  snapshot: WikiSnapshot;
  suggestions: WikiSuggestion[];
  contradictionEntryIds: string[];
  worlds: { id: string; title: string }[];
  activeWorldId: string;
}

export default function Wiki(props: WikiProps) {
  return (
    <DragProvider>
      <WikiInner {...props} />
    </DragProvider>
  );
}

function WikiInner({
  snapshot,
  suggestions,
  contradictionEntryIds,
  worlds,
  activeWorldId,
}: WikiProps) {
  const [state, dispatch] = useReducer(
    wikiReducer,
    { snapshot, suggestions },
    ({ snapshot, suggestions }) => {
      const s = initWikiState(snapshot, suggestions);
      const first = snapshot.entries.reduce<EntryWithDetails | undefined>(
        (lo, e) => (!lo || e.sortOrder < lo.sortOrder ? e : lo),
        undefined,
      );
      return { ...s, selectedEntryId: first ? first.id : s.selectedEntryId };
    },
  );
  const drag = useDrag();

  const contradictions = new Set(contradictionEntryIds);
  const select = useCallback(
    (id: string) => dispatch({ type: "SELECT_ENTRY", entryId: id }),
    [],
  );

  const surfaceError = useCallback(
    (error: string) => dispatch({ type: "SET_ERROR", error }),
    [],
  );

  const commit = useWikiCommit({ state, dispatch, worldId: activeWorldId });

  const selected = state.selectedEntryId
    ? state.byId[state.selectedEntryId]
    : undefined;

  const dropEntry = useCallback(
    (toShelf: ShelfKey, beforeId: string | null) => {
      const item = drag.dragging;
      if (!item || item.type !== "entry") return;
      commit({ type: "entry.move", entryId: item.id, toShelf, beforeId });
    },
    [drag.dragging, commit],
  );

  const dropFactOnEntry = useCallback(
    (toEntryId: string) => {
      const item = drag.dragging;
      if (!item || item.type !== "fact") return;
      commit({ type: "fact.move", factId: item.id, fromEntryId: item.from, toEntryId });
    },
    [drag.dragging, commit],
  );

  const dropOnTies = useCallback(() => {
    const item = drag.dragging;
    if (!item || item.type !== "entry") return;
    commit({ type: "tie.link", toEntryId: item.id });
  }, [drag.dragging, commit]);

  const addSuggestionToDetails = useCallback(
    (suggestionKey: string) => {
      const item = drag.dragging;
      if (!item || item.type !== "card") return;
      const s = state.suggestions.find((x) => x.suggestionKey === suggestionKey);
      if (!s) return;
      commit({ type: "suggestion.write", suggestion: s });
    },
    [drag.dragging, state.suggestions, commit],
  );

  const ai = useAiSuggest(surfaceError);

  const addSuggestedFact = useCallback(
    (entryId: string, key: string, value: string) => {
      commit({ type: "fact.create", entryId, key, value });
      ai.remove(entryId, key);
    },
    [commit, ai],
  );

  const writeSuggestion = useCallback(
    (s: WikiSuggestion) => commit({ type: "suggestion.write", suggestion: s }),
    [commit],
  );
  const leaveSuggestion = useCallback(
    (s: WikiSuggestion) => commit({ type: "suggestion.dismiss", suggestionKey: s.suggestionKey }),
    [commit],
  );

  const createEntryOnShelf = useCallback(
    (shelf: ShelfKey, categoryId?: string) =>
      commit({ type: "entry.create", shelf, categoryId }),
    [commit],
  );
  const createCategoryOnShelf = useCallback(
    (id: string, label: string) => commit({ type: "category.create", id, label }),
    [commit],
  );
  const renameCategoryLabel = useCallback(
    (categoryId: string, label: string) =>
      commit({ type: "category.rename", categoryId, label }),
    [commit],
  );
  const resetCategory = useCallback(
    (categoryId: string) => commit({ type: "category.reset", categoryId }),
    [commit],
  );
  const deleteEntry = useCallback(
    (entryId: string) => commit({ type: "entry.delete", entryId }),
    [commit],
  );
  const untieFromSelected = useCallback(
    (tieId: string) => commit({ type: "tie.untie", tieId }),
    [commit],
  );
  const tieExistingToSelected = useCallback(
    (toEntryId: string, rel: string) => commit({ type: "tie.link", toEntryId, rel }),
    [commit],
  );
  const createTiedToSelected = useCallback(
    (name: string, rel: string) => commit({ type: "tie.createEntry", name, rel }),
    [commit],
  );
  const editEntryField = useCallback(
    (entryId: string, field: "name" | "summary" | "note", value: string) =>
      commit({ type: "entry.edit", entryId, field, value }),
    [commit],
  );
  const editFactField = useCallback(
    (entryId: string, factId: string, field: "key" | "value", value: string) =>
      commit({ type: "fact.edit", entryId, factId, field, value }),
    [commit],
  );
  const addFact = useCallback(
    (entryId: string) => commit({ type: "fact.create", entryId, key: "Detail", value: "" }),
    [commit],
  );
  const deleteFactCallback = useCallback(
    (entryId: string, factId: string) => commit({ type: "fact.delete", entryId, factId }),
    [commit],
  );

  const [confirmDeleteKind, setConfirmDeleteKind] = useState<string | null>(null);

  const trash = useTrashPanel(dispatch);

  const byShelf = new Map<ShelfKey, EntryWithDetails[]>();
  for (const key of SHELF_ORDER) {
    byShelf.set(
      key,
      state.order[key]
        .map((id) => state.byId[id])
        .filter((e): e is EntryWithDetails => Boolean(e)),
    );
  }

  const byCategory = new Map<string, EntryWithDetails[]>();
  for (const cat of state.categories) byCategory.set(cat.id, []);
  for (const key of SHELF_ORDER) {
    for (const entry of byShelf.get(key) ?? []) {
      const bucket = byCategory.get(entry.kind);
      if (bucket) bucket.push(entry);
      else byCategory.set(entry.kind, [entry]);
    }
  }

  const liveEntryIds = new Set(Object.keys(state.byId));

  const confirmDeleteLabel = confirmDeleteKind
    ? categoryLabelById(state.categories, confirmDeleteKind)
    : "";

  const tieCandidates = selected
    ? Object.values(state.byId)
        .filter((e) => e.id !== selected.id)
        .map((e) => ({ id: e.id, name: e.name, kind: e.kind as string }))
    : [];

  const sidebarLabelFor = (id: string) =>
    categoryLabelById(state.categories, id);
  const sidebarIsRenamed = (id: string) =>
    id in KIND_SHELF && state.overrides[id as Kind] !== undefined;

  const sidebar = (
    <Sidebar
      categories={state.categories}
      byCategory={byCategory}
      selectedId={selected?.id ?? ""}
      onSelect={select}
      total={Object.keys(state.byId).length}
      onCreateEntry={createEntryOnShelf}
      onCreateCategory={createCategoryOnShelf}
      onRenameCategory={renameCategoryLabel}
      onResetCategory={resetCategory}
      onRequestDeleteCategory={setConfirmDeleteKind}
      isRenamed={sidebarIsRenamed}
      labelFor={sidebarLabelFor}
      footer={
        trash.deleted.length > 0 ? (
          <TrashPanel
            entries={trash.deleted}
            nowMs={trash.nowMs}
            busy={trash.busy}
            onRestore={trash.restore}
            onRequestPurge={() => trash.setConfirmPurge(true)}
          />
        ) : null
      }
    />
  );

  return (
    <div className={styles.layout}>
      {sidebar}
      <Main
        selected={selected}
        categories={state.categories}
        overrides={state.overrides}
        byCategory={byCategory}
        contradictions={contradictions}
        liveEntryIds={liveEntryIds}
        tieCandidates={tieCandidates}
        suggestions={state.suggestions}
        error={state.error}
        worlds={worlds}
        activeWorldId={activeWorldId}
        entryCount={Object.keys(state.byId).length}
        confirmDeleteKind={confirmDeleteKind}
        setConfirmDeleteKind={setConfirmDeleteKind}
        confirmDeleteLabel={confirmDeleteLabel}
        trash={trash}
        dispatch={dispatch}
        commit={commit}
        select={select}
        dropEntry={dropEntry}
        dropFactOnEntry={dropFactOnEntry}
        dropOnTies={dropOnTies}
        addSuggestionToDetails={addSuggestionToDetails}
        createEntryOnShelf={createEntryOnShelf}
        createCategoryOnShelf={createCategoryOnShelf}
        renameCategoryLabel={renameCategoryLabel}
        resetCategory={resetCategory}
        deleteEntry={deleteEntry}
        untieFromSelected={untieFromSelected}
        tieExistingToSelected={tieExistingToSelected}
        createTiedToSelected={createTiedToSelected}
        editEntryField={editEntryField}
        editFactField={editFactField}
        addFact={addFact}
        deleteFactCallback={deleteFactCallback}
        writeSuggestion={writeSuggestion}
        leaveSuggestion={leaveSuggestion}
        ai={ai}
        addSuggestedFact={addSuggestedFact}
      />
    </div>
  );
}
