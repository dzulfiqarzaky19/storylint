"use client";

// Wiki screen (HANDOFF §8). The reducer store (wikiStore) is the SESSION source
// of truth so drag feedback is instant; each reducer action is fired ALONGSIDE
// its matching Server Action (actions/wiki.ts), per-mutation, and a failed write
// is SURFACED (not swallowed) via an error banner. Native HTML5 DnD; drag
// session state lives in DragContext so dragover can read the payload.

import { useReducer, useCallback, useState, startTransition } from "react";
import type { WikiSnapshot, Shelf as ShelfKey, EntryWithDetails, Kind } from "@/lib/domain/types";
import { SHELF_TITLES, KIND_FOR_SHELF, KIND_LABEL } from "@/lib/domain/types";
import {
  initWikiState,
  wikiReducer,
  type WikiSuggestion,
} from "@/lib/state/wikiStore";
import { DragProvider, useDrag } from "@/components/dnd/DragContext";
import {
  moveEntry,
  linkEntry,
  moveFact,
  addSuggestionAsFact,
  dismissSuggestion,
  editEntry,
  editFact,
  createEntry,
  createFact,
  suggestEntryFacts,
  type ActionResult,
} from "@/lib/actions/wiki";
import EntryBand from "./EntryBand";
import WorldBand from "./WorldBand";
import Shelf from "./Shelf";
import PosterBand from "./PosterBand";
import WikiIndex from "./WikiIndex";
import styles from "./WikiScreen.module.css";

const SHELF_ORDER: ShelfKey[] = ["people", "places", "orders", "lore"];
/** Relationship label for a tie created by dropping a tile onto the Ties block. */
const LINKED_REL = "linked";

interface WikiScreenProps {
  snapshot: WikiSnapshot;
  suggestions: WikiSuggestion[];
  contradictionEntryIds: string[];
}

export default function WikiScreen(props: WikiScreenProps) {
  return (
    <DragProvider>
      <WikiScreenInner {...props} />
    </DragProvider>
  );
}

function WikiScreenInner({
  snapshot,
  suggestions,
  contradictionEntryIds,
}: WikiScreenProps) {
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
  const settle = useCallback((label: string, p: Promise<ActionResult<unknown>>) => {
    startTransition(() => {
      p.then((res) => {
        if (!res.ok) dispatch({ type: "SET_ERROR", error: res.error });
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        dispatch({ type: "SET_ERROR", error: `${label}: ${msg}` });
      });
    });
  }, []);

  // ---- Drop: tile onto tile (insert before) / onto shelf (append, regroup) --
  const dropEntry = useCallback(
    (toShelf: ShelfKey, beforeId: string | null) => {
      const item = drag.dragging;
      if (!item || item.type !== "entry") return;
      const entry = state.byId[item.id];
      if (!entry) return;
      const fromShelf = entry.shelf as ShelfKey;
      if (item.id === beforeId) return; // dropped on itself

      dispatch({ type: "MOVE_ENTRY", entryId: item.id, toShelf, beforeId });

      // Compute the resulting orders the same way the reducer does, so the
      // server persists exactly what the UI now shows.
      const withoutFrom = (shelf: ShelfKey) =>
        state.order[shelf].filter((id) => id !== item.id);
      const toOrder = withoutFrom(toShelf);
      const at = beforeId ? toOrder.indexOf(beforeId) : -1;
      if (at >= 0) toOrder.splice(at, 0, item.id);
      else toOrder.push(item.id);
      const fromOrder =
        fromShelf === toShelf ? toOrder : withoutFrom(fromShelf);

      settle(
        "moveEntry",
        moveEntry({
          entryId: item.id,
          toShelf,
          toShelfOrder: toOrder,
          fromShelf,
          fromShelfOrder: fromOrder,
        }),
      );
    },
    [drag.dragging, state.byId, state.order, settle],
  );

  // ---- Drop: fact row onto a tile (move fact between entries) ----------------
  const dropFactOnEntry = useCallback(
    (toEntryId: string) => {
      const item = drag.dragging;
      if (!item || item.type !== "fact") return;
      const fromEntryId = item.from;
      if (fromEntryId === toEntryId) return;
      const to = state.byId[toEntryId];
      if (!to) return;
      dispatch({ type: "MOVE_FACT", factId: item.id, fromEntryId, toEntryId });
      settle(
        "moveFact",
        moveFact({ factId: item.id, toEntryId, sortOrder: to.facts.length }),
      );
    },
    [drag.dragging, state.byId, settle],
  );

  // ---- Drop: tile onto Ties block (create a `linked` tie) --------------------
  const selected = state.selectedEntryId
    ? state.byId[state.selectedEntryId]
    : undefined;

  const dropOnTies = useCallback(() => {
    const item = drag.dragging;
    if (!item || item.type !== "entry" || !selected) return;
    if (item.id === selected.id) return; // don't tie an entry to itself
    const tieId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tie-${selected.id}-${item.id}-${Date.now()}`;
    dispatch({
      type: "LINK_ENTRY",
      tieId,
      fromEntryId: selected.id,
      toEntryId: item.id,
      rel: LINKED_REL,
    });
    settle(
      "linkEntry",
      linkEntry({ fromEntryId: selected.id, toEntryId: item.id, rel: LINKED_REL }),
    );
  }, [drag.dragging, selected, settle]);

  // ---- Drop: suggestion onto Details column (add as a fresh fact) ------------
  const addSuggestionToDetails = useCallback(
    (suggestionKey: string) => {
      const item = drag.dragging;
      if (!item || item.type !== "card") return;
      const s = state.suggestions.find((x) => x.suggestionKey === suggestionKey);
      if (!s) return;
      writeSuggestion(s);
    },
    [drag.dragging, state.suggestions],
  );

  // Shared: write a suggestion as a fresh fact (drop OR "Write it in" button).
  const writeSuggestion = useCallback(
    (s: WikiSuggestion) => {
      const entry = state.byId[s.entryId] ?? selected;
      if (!entry) return;
      const factId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `fact-${s.suggestionKey}-${Date.now()}`;
      const sortOrder = entry.facts.length;
      dispatch({
        type: "ADD_SUGGESTION_AS_FACT",
        suggestionKey: s.suggestionKey,
        entryId: entry.id,
        factId,
        key: s.key,
        value: s.value,
        sortOrder,
      });
      settle(
        "addSuggestionAsFact",
        addSuggestionAsFact({
          suggestionKey: s.suggestionKey,
          entryId: entry.id,
          key: s.key,
          value: s.value,
          sortOrder,
          confirmed: true,
        }),
      );
    },
    [state.byId, selected, settle],
  );

  const leaveSuggestion = useCallback(
    (s: WikiSuggestion) => {
      dispatch({ type: "DISMISS_SUGGESTION", suggestionKey: s.suggestionKey });
      settle("dismissSuggestion", dismissSuggestion(s.suggestionKey));
    },
    [settle],
  );

  // ---- Manual authoring (Track A) — edit in place + create ------------------
  const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const editEntryField = useCallback(
    (entryId: string, field: "name" | "summary" | "note", value: string) => {
      dispatch({ type: "EDIT_ENTRY_FIELDS", entryId, [field]: value });
      settle("editEntry", editEntry({ entryId, [field]: value }));
    },
    [settle],
  );

  const editFactField = useCallback(
    (entryId: string, factId: string, field: "key" | "value", value: string) => {
      dispatch({ type: "EDIT_FACT", entryId, factId, [field]: value });
      settle("editFact", editFact({ factId, [field]: value }));
    },
    [settle],
  );

  const addFact = useCallback(
    (entryId: string) => {
      const entry = state.byId[entryId];
      if (!entry) return;
      const factId = newId();
      const sortOrder = entry.facts.length;
      dispatch({
        type: "CREATE_FACT",
        entryId,
        factId,
        key: "Detail",
        value: "",
        sortOrder,
      });
      settle(
        "createFact",
        createFact({ entryId, key: "Detail", value: "", sortOrder }),
      );
    },
    [state.byId, settle],
  );

  // ---- AI: suggest details for the focused entry (read-only until Add) ------
  const [aiSuggestions, setAiSuggestions] = useState<
    Record<string, { key: string; value: string }[]>
  >({});
  const [aiBusy, setAiBusy] = useState(false);

  const suggestFacts = useCallback(
    (entryId: string) => {
      if (aiBusy) return;
      setAiBusy(true);
      startTransition(() => {
        suggestEntryFacts({ entryId })
          .then((res) => {
            if (res.ok) {
              setAiSuggestions((prev) => ({ ...prev, [entryId]: res.data.facts }));
            } else {
              dispatch({ type: "SET_ERROR", error: res.error });
            }
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            dispatch({ type: "SET_ERROR", error: `suggestEntryFacts: ${msg}` });
          })
          .finally(() => setAiBusy(false));
      });
    },
    [aiBusy],
  );

  // Add one AI suggestion as a real fact — routes through the SAME confirmation-
  // gated createFact path as manual authoring (product rule 1 intact).
  const addSuggestedFact = useCallback(
    (entryId: string, key: string, value: string) => {
      const entry = state.byId[entryId];
      if (!entry) return;
      const factId = newId();
      const sortOrder = entry.facts.length;
      dispatch({ type: "CREATE_FACT", entryId, factId, key, value, sortOrder });
      settle("createFact", createFact({ entryId, key, value, sortOrder }));
      // Remove the accepted suggestion from the panel.
      setAiSuggestions((prev) => ({
        ...prev,
        [entryId]: (prev[entryId] ?? []).filter((s) => s.key !== key),
      }));
    },
    [state.byId, settle],
  );

  const dismissSuggestedFact = useCallback((entryId: string, key: string) => {
    setAiSuggestions((prev) => ({
      ...prev,
      [entryId]: (prev[entryId] ?? []).filter((s) => s.key !== key),
    }));
  }, []);

  const createEntryOnShelf = useCallback(
    (shelf: ShelfKey) => {
      const kind: Kind = KIND_FOR_SHELF[shelf];
      const name = `New ${KIND_LABEL[kind].toLowerCase()}`;
      const entryId = newId();
      // Client-generated id is passed to the server so the reducer row and the
      // persisted row share one id — no reconciliation needed. sortOrder just
      // appends to the shelf.
      const sortOrder = state.order[shelf].length;
      dispatch({
        type: "CREATE_ENTRY",
        entryId,
        kind,
        shelf,
        name,
        note: "",
        summary: "",
        sortOrder,
      });
      settle("createEntry", createEntry({ id: entryId, kind, shelf, name }));
    },
    [state.order, settle],
  );


  // Entries grouped per shelf, in the reducer's live order.
  const byShelf = new Map<ShelfKey, EntryWithDetails[]>();
  for (const key of SHELF_ORDER) {
    byShelf.set(
      key,
      state.order[key]
        .map((id) => state.byId[id])
        .filter((e): e is EntryWithDetails => Boolean(e)),
    );
  }

  if (!selected) {
    return (
      <div className={styles.layout}>
        <WikiIndex
          byShelf={byShelf}
          selectedId=""
          onSelect={select}
          total={Object.keys(state.byId).length}
          onCreate={createEntryOnShelf}
        />
        <main className={styles.body}>
          <p className={styles.empty}>No entries in the gazetteer yet.</p>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <WikiIndex
        byShelf={byShelf}
        selectedId={selected.id}
        onSelect={select}
        total={Object.keys(state.byId).length}
        onCreate={createEntryOnShelf}
      />
      <main className={styles.body}>
      {state.error && (
        <div className={styles.errorBar} role="alert">
          Save failed: {state.error}
          <button
            type="button"
            className={styles.errorDismiss}
            onClick={() => dispatch({ type: "SET_ERROR", error: null })}
          >
            Dismiss
          </button>
        </div>
      )}

      <EntryBand
        entry={selected}
        onSelect={select}
        onDropOnTies={dropOnTies}
        onDropSuggestion={addSuggestionToDetails}
        onEditEntryField={editEntryField}
        onEditFactField={editFactField}
        onAddFact={addFact}
        ai={{
          suggestions: aiSuggestions[selected.id] ?? [],
          busy: aiBusy,
          onSuggest: () => suggestFacts(selected.id),
          onAdd: (key, value) => addSuggestedFact(selected.id, key, value),
          onDismiss: (key) => dismissSuggestedFact(selected.id, key),
        }}
      />
      <WorldBand entryCount={Object.keys(state.byId).length} />
      <div className={styles.shelves}>
        {SHELF_ORDER.map((key) => (
          <Shelf
            key={key}
            shelf={key}
            title={SHELF_TITLES[key]}
            entries={byShelf.get(key) ?? []}
            selectedId={selected.id}
            contradictions={contradictions}
            onSelect={select}
            onDropEntry={dropEntry}
            onDropFactOnEntry={dropFactOnEntry}
          />
        ))}
      </div>
      <PosterBand
        suggestions={state.suggestions}
        onWriteIn={writeSuggestion}
        onLeave={leaveSuggestion}
      />
    </main>
    </div>
  );
}
