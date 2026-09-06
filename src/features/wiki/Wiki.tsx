"use client";

// Wiki screen. The reducer store (wikiStore) is the SESSION source
// of truth so drag feedback is instant; each reducer action is fired ALONGSIDE
// its matching Server Action (actions/wiki.ts), per-mutation, and a failed write
// is SURFACED (not swallowed) via an error banner. Native HTML5 DnD; drag
// session state lives in DragContext so dragover can read the payload.

import { useReducer, useCallback, useState } from "react";
import { useAiSuggest } from "./hooks/useAiSuggest";
import { useTrashPanel } from "./Sidebar/hooks/useTrashPanel";
import type { WikiSnapshot, Shelf as ShelfKey, EntryWithDetails, Kind } from "@/lib/domain/types";
import { KIND_SHELF } from "@/lib/domain/types";
import {
  initWikiState,
  wikiReducer,
  type WikiSuggestion,
} from "@/lib/state/wikiStore";
import { DragProvider, useDrag } from "@/components/dnd/DragContext";
import { useWikiCommit } from "./hooks/useWikiCommit";
import { categoryLabelById } from "@/lib/wiki/categoryLabels";
import Sidebar from "./Sidebar/Sidebar";
import TrashPanel from "./Sidebar/TrashPanel";
import Main from "./Main/Main";
import styles from "./Wiki.module.css";

const SHELF_ORDER: ShelfKey[] = ["people", "places", "orders", "lore"];

interface WikiProps {
  snapshot: WikiSnapshot;
  suggestions: WikiSuggestion[];
  contradictionEntryIds: string[];
  /** TCK-023 (W-4b): every world across universes — the entry share-target pool. */
  worlds: { id: string; title: string }[];
  /** TCK-023 (W-4b): the world currently being viewed (the unlink target). */
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
      // Default to the lowest global sortOrder entry (the gazetteer's first, Maren).
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

  // Surface a failed server action instead of letting the write vanish (§8).
  const surfaceError = useCallback(
    (error: string) => dispatch({ type: "SET_ERROR", error }),
    [],
  );

  // THE write-through. Every gazetteer mutation on this screen is one `commit`
  // of an intent; ids, append positions, the product-rule-1 confirmation, the
  // active world, the error label, and the optimistic/persist pairing all live
  // inside it. This screen no longer knows any of them.
  const commit = useWikiCommit({ state, dispatch, worldId: activeWorldId });

  const selected = state.selectedEntryId
    ? state.byId[state.selectedEntryId]
    : undefined;

  // ---- Drops. The screen owns only the DRAG SESSION: read the payload, decide
  // which intent it means, and commit it. ------------------------------------
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

  // ---- AI: suggest details for the focused entry (read-only until Add) ------
  const ai = useAiSuggest(surfaceError);

  // Accepting an AI suggestion is the SAME confirmed fact write as manual
  // authoring (product rule 1 intact); the only extra is clearing the panel row.
  const addSuggestedFact = useCallback(
    (entryId: string, key: string, value: string) => {
      commit({ type: "fact.create", entryId, key, value });
      ai.remove(entryId, key);
    },
    [commit, ai],
  );

  // Suggestions "Write it in" / "Leave it".
  const writeSuggestion = useCallback(
    (s: WikiSuggestion) => commit({ type: "suggestion.write", suggestion: s }),
    [commit],
  );
  const leaveSuggestion = useCallback(
    (s: WikiSuggestion) => commit({ type: "suggestion.dismiss", suggestionKey: s.suggestionKey }),
    [commit],
  );

  // ---- Child prop adapters. Each is ONE intent; the children keep their own
  // callback shapes, and nothing about ids/ordering/confirmation leaks into them.
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

  // The category id whose whole-category delete awaits confirmation (null = none).
  const [confirmDeleteKind, setConfirmDeleteKind] = useState<string | null>(null);

  // ---- Trash: recently-deleted panel (F6-S6b) --------------------------------
  // Panel-local server state + restore/purge live in useTrashPanel. Restore
  // awaits the live row then dispatches RESTORE_ENTRY inside the panel, so this
  // screen never learns that action.
  const trash = useTrashPanel(dispatch);

  // Entries grouped per shelf, in the reducer's live order (Sidebar still
  // groups by the fixed 4 shelves).
  const byShelf = new Map<ShelfKey, EntryWithDetails[]>();
  for (const key of SHELF_ORDER) {
    byShelf.set(
      key,
      state.order[key]
        .map((id) => state.byId[id])
        .filter((e): e is EntryWithDetails => Boolean(e)),
    );
  }

  // F9-B S3: entries grouped by CATEGORY id (entry.kind), preserving each
  // shelf's live order. Built-ins keep their Kind-string id; user categories
  // are UUIDs. Every category in state.categories renders its own group (in the
  // reducer's already-sorted category order), so a category with zero live
  // entries still shows an (empty) shelf header that can be renamed/deleted.
  const byCategory = new Map<string, EntryWithDetails[]>();
  for (const cat of state.categories) byCategory.set(cat.id, []);
  for (const key of SHELF_ORDER) {
    for (const entry of byShelf.get(key) ?? []) {
      const bucket = byCategory.get(entry.kind);
      if (bucket) bucket.push(entry);
      else byCategory.set(entry.kind, [entry]);
    }
  }

  // The set of LIVE entry ids (soft-deleted entries were filtered out of the
  // snapshot at load, so byId holds only live entries). A tie pointing at
  // anything NOT in this set is dangling and renders as a "removed" tombstone.
  const liveEntryIds = new Set(Object.keys(state.byId));

  // Resolved header label for the category pending whole-category delete (F9-B
  // S3): from the live category list, so a user category (no built-in default)
  // shows its own label in the danger confirm rather than a raw UUID.
  const confirmDeleteLabel = confirmDeleteKind
    ? categoryLabelById(state.categories, confirmDeleteKind)
    : "";

  // Every OTHER live entry is a candidate to tie the focused entry to. Computed
  // from the same live byId map so a just-created/soft-deleted entry appears or
  // disappears from the add-tie picker immediately.
  const tieCandidates = selected
    ? Object.values(state.byId)
        .filter((e) => e.id !== selected.id)
        .map((e) => ({ id: e.id, name: e.name, kind: e.kind as string }))
    : [];

  // TCK-005: sidebar category-header helpers, matching the main shelf's
  // per-category rename/label rules so both columns resolve labels and the
  // Reset affordance identically (built-in override vs user category).
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
