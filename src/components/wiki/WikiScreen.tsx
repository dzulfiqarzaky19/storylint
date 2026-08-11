"use client";

// Wiki screen (HANDOFF §8). The reducer store (wikiStore) is the SESSION source
// of truth so drag feedback is instant; each reducer action is fired ALONGSIDE
// its matching Server Action (actions/wiki.ts), per-mutation, and a failed write
// is SURFACED (not swallowed) via an error banner. Native HTML5 DnD; drag
// session state lives in DragContext so dragover can read the payload.

import { useReducer, useCallback, useEffect, useState, startTransition } from "react";
import type { WikiSnapshot, Shelf as ShelfKey, EntryWithDetails, EntryRow, Kind } from "@/lib/domain/types";
import { KIND_SHELF, KIND_FOR_SHELF, KIND_LABEL } from "@/lib/domain/types";
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
  softDeleteEntry,
  untie,
  createEntryTied,
  renameCategory,
  resetCategoryLabel,
  deleteCategory,
  createCategory,
  getDeletedEntries,
  restoreEntry,
  purgeExpiredDeleted,
  type ActionResult,
} from "@/lib/actions/wiki";
import { resolveCategoryLabel, categoryLabelById } from "@/lib/wiki/categoryLabels";
import { trashCountdown } from "@/lib/wiki/trashCountdown";
import EntryBand from "./EntryBand";
import WorldBand from "./WorldBand";
import Shelf from "./Shelf";
import PosterBand from "./PosterBand";
import WikiIndex from "./WikiIndex";
import NewCategoryShelf from "./NewCategoryShelf";
import TrashPanel from "./TrashPanel";
import ConfirmModal from "../ui/ConfirmModal";
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

  // ---- Ties block authoring: untie / tie-existing / create-new-and-tie -------
  // Each dispatches the reducer action ALONGSIDE its confirmation-gated server
  // action (untie is a HARD delete, gated behind the TiesBlock danger confirm;
  // the guard lives in TiesBlock, this just performs the removal).
  const untieFromSelected = useCallback(
    (tieId: string) => {
      if (!selected) return;
      dispatch({ type: "UNTIE", fromEntryId: selected.id, tieId });
      settle("untie", untie({ tieId }));
    },
    [selected, settle],
  );

  // Tie the focused entry to an EXISTING entry, with the writer's rel label.
  const tieExistingToSelected = useCallback(
    (toEntryId: string, rel: string) => {
      if (!selected || toEntryId === selected.id) return;
      const tieId = newId();
      const label = rel.trim() || LINKED_REL;
      dispatch({
        type: "LINK_ENTRY",
        tieId,
        fromEntryId: selected.id,
        toEntryId,
        rel: label,
      });
      settle(
        "linkEntry",
        linkEntry({ fromEntryId: selected.id, toEntryId, rel: label }),
      );
    },
    [selected, settle],
  );

  // Create a NEW entry (on the focused entry's shelf/kind) and tie it in, both
  // in one confirmation-gated transaction (createEntryTied). The reducer mirrors
  // it optimistically with the same ids so the DB and session agree.
  const createTiedToSelected = useCallback(
    (name: string, rel: string) => {
      if (!selected) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const shelf = selected.shelf as ShelfKey;
      const kind: Kind = KIND_FOR_SHELF[shelf];
      const entryId = newId();
      const tieId = newId();
      const label = rel.trim() || LINKED_REL;
      dispatch({
        type: "CREATE_TIED",
        entryId,
        tieId,
        kind,
        shelf,
        name: trimmed,
        toEntryId: selected.id,
        rel: label,
      });
      settle(
        "createEntryTied",
        createEntryTied({
          name: trimmed,
          kind,
          shelf,
          toEntryId: selected.id,
          rel: label,
          confirmed: true,
        }),
      );
    },
    [selected, settle],
  );

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
  // Hoisted function (not a const arrow) so the tie-authoring callbacks declared
  // ABOVE the manual-authoring section can call it without a TDZ error.
  function newId() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

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

  // Soft-delete an entry: optimistically drop it from the session (index +
  // selection), then persist the deleted_at stamp. Its ties from other entries
  // become dangling "removed" tombstones on next render.
  const deleteEntry = useCallback(
    (entryId: string) => {
      dispatch({ type: "SOFT_DELETE_ENTRY", entryId });
      settle("softDeleteEntry", softDeleteEntry({ id: entryId }));
    },
    [settle],
  );

  // ---- Category headers (F6-S5b; F9-B S3): rename / reset / delete / create ---
  // Each optimistic reducer action fires ALONGSIDE its server action, per the
  // §8 write-through pattern. Rename/reset touch only the label (no confirm).
  // Deleting a whole category soft-deletes EVERY live entry of the category, so
  // it is gated behind the danger ConfirmModal below. F9-B S3: `kind` is a
  // CATEGORY ID (string) — built-ins keep their legacy Kind-string ids, user
  // categories are UUIDs — so rename/reset/delete work on ANY category.
  const renameCategoryLabel = useCallback(
    (kind: string, label: string) => {
      dispatch({ type: "RENAME_CATEGORY", kind, label });
      settle("renameCategory", renameCategory({ kind, label }));
    },
    [settle],
  );

  const resetCategory = useCallback(
    (kind: string) => {
      dispatch({ type: "RESET_CATEGORY", kind });
      settle("resetCategoryLabel", resetCategoryLabel({ kind }));
    },
    [settle],
  );

  // The category id whose whole-category delete awaits confirmation (null = none).
  const [confirmDeleteKind, setConfirmDeleteKind] = useState<string | null>(null);

  const performDeleteCategory = useCallback(
    (kind: string) => {
      dispatch({ type: "DELETE_CATEGORY", kind });
      settle("deleteCategory", deleteCategory({ kind, confirmed: true }));
    },
    [settle],
  );

  // F9-B S3: create a brand-new user category on a shelf. The child
  // NewCategoryShelf mints a client id ONCE per form-open (TCK-010) and passes
  // it in, so a double-invoked commit reuses the same id; the server INSERT has
  // ON CONFLICT (id) DO NOTHING, collapsing a double-fire to exactly one row.
  // The reducer appends the returned row (CREATE_CATEGORY) so it appears as its
  // own group immediately. A blank label is ignored here (the server also
  // rejects it) so the cancel path is a harmless no-op.
  const createCategoryOnShelf = useCallback(
    (id: string, label: string, shelf: ShelfKey) => {
      const trimmed = label.trim();
      if (trimmed === "") return;
      // `id` is minted once per form-open by NewCategoryShelf and reused across
      // a double-invoked commit, so the create is idempotent (server INSERT ...
      // ON CONFLICT (id) DO NOTHING) and one click writes exactly one row.
      startTransition(() => {
        createCategory({ id, label: trimmed, shelf })
          .then((res) => {
            if (res.ok) dispatch({ type: "CREATE_CATEGORY", category: res.data });
            else dispatch({ type: "SET_ERROR", error: res.error });
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            dispatch({ type: "SET_ERROR", error: `createCategory: ${msg}` });
          });
      });
    },
    [],
  );

  // ---- Trash: recently-deleted panel (F6-S6b) --------------------------------
  // The trash list is panel-LOCAL server state (soft-deleted entries live only
  // in the DB, never in the reducer's live byId), so it is fetched here and
  // re-fetched after every restore/purge. Restore ALSO dispatches RESTORE_ENTRY
  // so the entry reappears on its shelf without a full reload; purge has no
  // reducer (nothing live changes) and just refreshes the panel.
  const [deleted, setDeleted] = useState<EntryRow[]>([]);
  const [trashBusy, setTrashBusy] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  // Fixed at mount so the countdown labels don't reflow every render.
  const [nowMs] = useState(() => Date.now());

  const refreshTrash = useCallback(() => {
    startTransition(() => {
      getDeletedEntries()
        .then((res) => {
          if (res.ok) setDeleted(res.data.entries);
          else dispatch({ type: "SET_ERROR", error: res.error });
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          dispatch({ type: "SET_ERROR", error: `getDeletedEntries: ${msg}` });
        });
    });
  }, []);

  // Load the trash once on mount, then re-fetch it whenever a delete happens by
  // way of the restore/purge handlers below (they call refreshTrash on settle).
  useEffect(() => {
    refreshTrash();
  }, [refreshTrash]);

  const restoreDeleted = useCallback(
    (id: string) => {
      setTrashBusy(true);
      startTransition(() => {
        restoreEntry({ id })
          .then((res) => {
            if (res.ok) {
              dispatch({ type: "RESTORE_ENTRY", entry: res.data.entry });
              setDeleted((prev) => prev.filter((e) => e.id !== id));
            } else {
              dispatch({ type: "SET_ERROR", error: res.error });
            }
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            dispatch({ type: "SET_ERROR", error: `restoreEntry: ${msg}` });
          })
          .finally(() => setTrashBusy(false));
      });
    },
    [],
  );

  const performPurge = useCallback(() => {
    setTrashBusy(true);
    startTransition(() => {
      purgeExpiredDeleted({ confirmed: true })
        .then((res) => {
          if (res.ok) refreshTrash();
          else dispatch({ type: "SET_ERROR", error: res.error });
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          dispatch({ type: "SET_ERROR", error: `purgeExpiredDeleted: ${msg}` });
        })
        .finally(() => setTrashBusy(false));
    });
  }, [refreshTrash]);

  // How many trashed entries the next purge would actually remove (retention
  // elapsed) — drives the danger-modal copy's exact count.
  const purgeableCount = deleted.filter(
    (e) => e.deletedAt != null && trashCountdown(e.deletedAt, nowMs).purgeable,
  ).length;

  // Entries grouped per shelf, in the reducer's live order (WikiIndex still
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

  if (!selected) {
    return (
      <div className={styles.layout}>
        <WikiIndex
          byShelf={byShelf}
          selectedId=""
          onSelect={select}
          total={Object.keys(state.byId).length}
          onCreate={createEntryOnShelf}
          overrides={state.overrides}
          footer={
            deleted.length > 0 ? (
              <TrashPanel
                entries={deleted}
                nowMs={nowMs}
                busy={trashBusy}
                onRestore={restoreDeleted}
                onRequestPurge={() => setConfirmPurge(true)}
              />
            ) : null
          }
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
        overrides={state.overrides}
        footer={
          deleted.length > 0 ? (
            <TrashPanel
              entries={deleted}
              nowMs={nowMs}
              busy={trashBusy}
              onRestore={restoreDeleted}
              onRequestPurge={() => setConfirmPurge(true)}
            />
          ) : null
        }
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
        liveEntryIds={liveEntryIds}
        tieCandidates={tieCandidates}
        onSelect={select}
        onDelete={deleteEntry}
        onDropOnTies={dropOnTies}
        onUntie={untieFromSelected}
        onTieExisting={tieExistingToSelected}
        onCreateTied={createTiedToSelected}
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
        {state.categories.map((cat) => (
          <Shelf
            key={cat.id}
            shelf={cat.shelf as ShelfKey}
            categoryId={cat.id}
            title={categoryLabelById(state.categories, cat.id)}
            entries={byCategory.get(cat.id) ?? []}
            selectedId={selected.id}
            contradictions={contradictions}
            onSelect={select}
            onDropEntry={dropEntry}
            onDropFactOnEntry={dropFactOnEntry}
            onRenameCategory={renameCategoryLabel}
            onResetCategory={resetCategory}
            onRequestDeleteCategory={setConfirmDeleteKind}
            onCreate={createEntryOnShelf}
            isRenamed={
              cat.id in KIND_SHELF &&
              state.overrides[cat.id as Kind] !== undefined
            }
            isBuiltin={cat.id in KIND_SHELF}
          />
        ))}
        <NewCategoryShelf onCreate={createCategoryOnShelf} />
      </div>
      <PosterBand
        suggestions={state.suggestions}
        onWriteIn={writeSuggestion}
        onLeave={leaveSuggestion}
      />
      {confirmDeleteKind ? (
        <ConfirmModal
          title={`Delete the ${confirmDeleteLabel} category?`}
          body={`This removes all ${
            byCategory.get(confirmDeleteKind)?.length ?? 0
          } ${confirmDeleteLabel} entries from the gazetteer. Ties pointing at them will be marked as removed.`}
          confirmLabel="Delete category"
          cancelLabel="Cancel"
          danger
          onConfirm={() => {
            const kind = confirmDeleteKind;
            setConfirmDeleteKind(null);
            performDeleteCategory(kind);
          }}
          onCancel={() => setConfirmDeleteKind(null)}
        />
      ) : null}
      {confirmPurge ? (
        <ConfirmModal
          title="Empty the trash?"
          body={`This permanently deletes ${purgeableCount} ${
            purgeableCount === 1 ? "entry that has" : "entries that have"
          } been in the trash longer than 7 days, along with all their facts, ties, and appearances. This cannot be undone.`}
          confirmLabel="Empty trash"
          cancelLabel="Cancel"
          danger
          onConfirm={() => {
            setConfirmPurge(false);
            performPurge();
          }}
          onCancel={() => setConfirmPurge(false)}
        />
      ) : null}
    </main>
    </div>
  );
}
