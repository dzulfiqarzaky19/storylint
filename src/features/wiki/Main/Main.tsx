"use client";

import type { Dispatch } from "react";
import type { CategoryRow, EntryWithDetails, Kind, Shelf as ShelfKey } from "@/lib/domain/types";
import { KIND_SHELF } from "@/lib/domain/types";
import type { WikiAction, WikiSuggestion } from "@/lib/state/wikiStore";
import { categoryLabelById } from "@/lib/wiki/categoryLabels";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { WikiCommit } from "../hooks/useWikiCommit";
import type { TieCandidate } from "./EntryDetail/Ties";
import EntryDetail from "./EntryDetail/EntryDetail";
import CategoryList from "./CategoryList/CategoryList";
import Suggestions from "./Suggestions";
import styles from "./Main.module.css";

interface MainProps {
  selected: EntryWithDetails | undefined;
  categories: CategoryRow[];
  overrides: Partial<Record<Kind, string>>;
  byCategory: Map<string, EntryWithDetails[]>;
  contradictions: Set<string>;
  liveEntryIds: Set<string>;
  tieCandidates: TieCandidate[];
  suggestions: WikiSuggestion[];
  error: string | null;
  worlds: { id: string; title: string }[];
  activeWorldId: string;
  entryCount: number;
  confirmDeleteKind: string | null;
  setConfirmDeleteKind: (id: string | null) => void;
  confirmDeleteLabel: string;
  trash: {
    confirmPurge: boolean;
    setConfirmPurge: (open: boolean) => void;
    purgeableCount: number;
    purge: () => void;
  };
  dispatch: Dispatch<WikiAction>;
  commit: WikiCommit;
  select: (id: string) => void;
  dropEntry: (toShelf: ShelfKey, beforeId: string | null) => void;
  dropFactOnEntry: (toEntryId: string) => void;
  dropOnTies: () => void;
  addSuggestionToDetails: (suggestionKey: string) => void;
  createEntryOnShelf: (shelf: ShelfKey, categoryId?: string) => void;
  createCategoryOnShelf: (id: string, label: string) => void;
  renameCategoryLabel: (categoryId: string, label: string) => void;
  resetCategory: (categoryId: string) => void;
  deleteEntry: (entryId: string) => void;
  untieFromSelected: (tieId: string) => void;
  tieExistingToSelected: (toEntryId: string, rel: string) => void;
  createTiedToSelected: (name: string, rel: string) => void;
  editEntryField: (
    entryId: string,
    field: "name" | "summary" | "note",
    value: string,
  ) => void;
  editFactField: (
    entryId: string,
    factId: string,
    field: "key" | "value",
    value: string,
  ) => void;
  addFact: (entryId: string) => void;
  deleteFactCallback: (entryId: string, factId: string) => void;
  writeSuggestion: (s: WikiSuggestion) => void;
  leaveSuggestion: (s: WikiSuggestion) => void;
  ai: {
    suggestions: Record<string, { key: string; value: string }[]>;
    busy: boolean;
    suggest: (entryId: string) => void;
    remove: (entryId: string, key: string) => void;
  };
  addSuggestedFact: (entryId: string, key: string, value: string) => void;
}

export default function Main({
  selected,
  categories,
  overrides,
  byCategory,
  contradictions,
  liveEntryIds,
  tieCandidates,
  suggestions,
  error,
  worlds,
  activeWorldId,
  entryCount,
  confirmDeleteKind,
  setConfirmDeleteKind,
  confirmDeleteLabel,
  trash,
  dispatch,
  commit,
  select,
  dropEntry,
  dropFactOnEntry,
  dropOnTies,
  addSuggestionToDetails,
  createEntryOnShelf,
  createCategoryOnShelf,
  renameCategoryLabel,
  resetCategory,
  deleteEntry,
  untieFromSelected,
  tieExistingToSelected,
  createTiedToSelected,
  editEntryField,
  editFactField,
  addFact,
  deleteFactCallback,
  writeSuggestion,
  leaveSuggestion,
  ai,
  addSuggestedFact,
}: MainProps) {
  if (!selected) {
    return (
      <main className={styles.body}>
        <p className={styles.empty}>No entries in the gazetteer yet.</p>
      </main>
    );
  }

  return (
    <main className={styles.body}>
      {error && (
        <div className={styles.errorBar} role="alert">
          Save failed: {error}
          <button
            type="button"
            className={styles.errorDismiss}
            onClick={() => dispatch({ type: "SET_ERROR", error: null })}
          >
            Dismiss
          </button>
        </div>
      )}

      <EntryDetail
        entry={selected}
        liveEntryIds={liveEntryIds}
        tieCandidates={tieCandidates}
        onSelect={select}
        onDelete={deleteEntry}
        sharing={{
          worlds,
          activeWorldId,
          onError: (message) => dispatch({ type: "SET_ERROR", error: message }),
        }}
        onDropOnTies={dropOnTies}
        onUntie={untieFromSelected}
        onTieExisting={tieExistingToSelected}
        onCreateTied={createTiedToSelected}
        onDropSuggestion={addSuggestionToDetails}
        onEditEntryField={editEntryField}
        onEditFactField={editFactField}
        onAddFact={addFact}
        onDeleteFact={deleteFactCallback}
        ai={{
          suggestions: ai.suggestions[selected.id] ?? [],
          busy: ai.busy,
          onSuggest: () => ai.suggest(selected.id),
          onAdd: (key, value) => addSuggestedFact(selected.id, key, value),
          onDismiss: (key) => ai.remove(selected.id, key),
        }}
      />
      <CategoryList
        categories={categories}
        byCategory={byCategory}
        selectedId={selected.id}
        contradictions={contradictions}
        entryCount={entryCount}
        onSelect={select}
        onDropEntry={dropEntry}
        onDropFactOnEntry={dropFactOnEntry}
        onRenameCategory={renameCategoryLabel}
        onResetCategory={resetCategory}
        onRequestDeleteCategory={setConfirmDeleteKind}
        onCreate={createEntryOnShelf}
        onCreateCategory={createCategoryOnShelf}
        isRenamed={(id) =>
          id in KIND_SHELF && overrides[id as Kind] !== undefined
        }
        isBuiltin={(id) => id in KIND_SHELF}
        titleFor={(id) => categoryLabelById(categories, id)}
      />
      <Suggestions
        suggestions={suggestions}
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
            const categoryId = confirmDeleteKind;
            setConfirmDeleteKind(null);
            commit({ type: "category.delete", categoryId });
          }}
          onCancel={() => setConfirmDeleteKind(null)}
        />
      ) : null}
      {trash.confirmPurge ? (
        <ConfirmModal
          title="Empty the trash?"
          body={`This permanently deletes ${trash.purgeableCount} ${
            trash.purgeableCount === 1 ? "entry that has" : "entries that have"
          } been in the trash longer than 7 days, along with all their facts, ties, and appearances. This cannot be undone.`}
          confirmLabel="Empty trash"
          cancelLabel="Cancel"
          danger
          onConfirm={() => {
            trash.setConfirmPurge(false);
            trash.purge();
          }}
          onCancel={() => trash.setConfirmPurge(false)}
        />
      ) : null}
    </main>
  );
}
